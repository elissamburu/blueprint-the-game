// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Hono app of the Studio, with the security rules of ADR-0025 §4 (S1–S12). `pnpm studio`
// serves it with the built UI; the Vite dev server mounts it for /api and /icons.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { errorResponse, StudioError } from "./errors.js";
import { createContentStore } from "./content-store.js";
import { nodeFs, type ContentFs } from "./fs.js";
import type { Log } from "./log.js";
import { scenarioRoutes } from "./routes/scenarios.js";
import { sharedRoutes } from "./routes/shared.js";
import { apiGuard, CSP, hostGuard, securityHeaders } from "./security.js";
import { registerClient, registerIcons, type ClientFiles } from "./static.js";

/** S6: the largest scenario weighs about 20 KB. */
export const BODY_LIMIT = 1024 * 1024;

export interface AppOptions {
  /** The port the server listens on: S2 and S3 accept only Host and Origin with it. */
  port: number;
  /** Session token (S3, S12). */
  token: string;
  contentDir: string;
  iconsDir: string;
  /** Git config files with the author of new scenarios (RF-STU-01), global first. */
  gitConfigFiles?: readonly string[];
  log: Log;
  /** The built UI; without it (Vite dev server) only /api and /icons are served. */
  client?: ClientFiles;
  fs?: ContentFs;
  /** S9: Content-Security-Policy; the dev server passes its own (see README). */
  csp?: string;
}

export const createApp = ({
  port,
  token,
  contentDir,
  iconsDir,
  gitConfigFiles = [],
  log,
  client,
  fs = nodeFs,
  csp = CSP,
}: AppOptions): Hono => {
  const store = createContentStore({ fs, contentDir, gitConfigFiles });
  const app = new Hono();

  // S9 first, so every response carries the headers, errors included.
  app.use("*", securityHeaders(csp));
  app.use("*", hostGuard(port));
  app.use("/api/*", apiGuard({ port, token }));
  app.use(
    "/api/*",
    bodyLimit({
      maxSize: BODY_LIMIT,
      onError: (c) =>
        errorResponse(c, 413, "payload-too-large", "El cuerpo del pedido supera 1 MiB."),
    }),
  );
  app.route("/api/scenarios", scenarioRoutes(store));
  app.route("/api/shared", sharedRoutes(store));
  registerIcons(app, fs, iconsDir);
  if (client !== undefined) registerClient(app, fs, client, token);

  app.notFound((c) => errorResponse(c, 404, "not-found", "No existe."));
  app.onError((error, c) => {
    if (error instanceof StudioError) {
      return errorResponse(c, error.status, error.code, error.message, error.line);
    }
    // S12: the log never gets headers nor bodies, so the token cannot end up there.
    log.error(
      `Error interno en ${c.req.method} ${c.req.path}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return errorResponse(
      c,
      500,
      "internal",
      "Error interno del Studio: mirá la consola donde corre pnpm studio.",
    );
  });
  return app;
};
