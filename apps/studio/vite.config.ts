// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UI of the Studio. `vite build` writes dist/client, which `pnpm studio` serves with the Hono server.
// `vite` (the Studio inside `pnpm dev`) is the development mode of ADR-0025 §4: the same Hono app
// runs inside the Vite process for /api and /icons, and the rules S1–S12 apply with the
// exceptions documented in README.md ("Modo desarrollo").
import { randomBytes } from "node:crypto";
import { getRequestListener } from "@hono/node-server";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { createApp } from "./server/app.js";
import { HOST, readConfig, REPO_ROOT } from "./server/config.js";
import { consoleLog } from "./server/log.js";
import { createToken, isAllowedHost, securityHeaderEntries } from "./server/security.js";
import { injectToken } from "./server/static.js";

const config = readConfig();
/** Per process: the HTML of the dev server is the same for every request. */
const nonce = randomBytes(16).toString("base64url");

/**
 * Content-Security-Policy of the dev server. Differences with S9: the inline preamble of React
 * Fast Refresh runs with a nonce (Vite adds it to the tags it injects, html.cspNonce), and the HMR
 * websocket of the same host is allowed. Still no 'unsafe-inline' nor 'unsafe-eval' in scripts.
 */
export const devCsp = (port: number): string =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src 'self' ws://127.0.0.1:${port} ws://localhost:${port}`,
    "frame-ancestors 'none'",
  ].join("; ");

const studioServer = (): Plugin => {
  const token = createToken();
  return {
    name: "blueprint-studio-server",
    apply: "serve",
    configureServer(server) {
      const { port } = config;
      const csp = devCsp(port);
      const api = getRequestListener(
        createApp({
          port,
          token,
          contentDir: config.contentDir,
          iconsDir: config.iconsDir,
          gitConfigFiles: config.gitConfigFiles,
          log: consoleLog(),
          csp,
        }).fetch,
      );
      // Before Vite's own middlewares: S2 and S9 for every response, the modules Vite serves
      // included; /api and /icons go to the Hono app, with S3–S8 and S10–S12 as in pnpm studio.
      server.middlewares.use((req, res, next) => {
        if (!isAllowedHost(req.headers.host, port)) {
          res.statusCode = 421;
          res.end("Misdirected Request");
          return;
        }
        for (const [name, value] of securityHeaderEntries(csp)) res.setHeader(name, value);
        const url = req.url ?? "";
        if (url.startsWith("/api/") || url.startsWith("/icons/")) {
          void api(req, res);
          return;
        }
        next();
      });
    },
    // S3: the same meta tag pnpm studio injects. Only in memory, never written (S12).
    transformIndexHtml: (html) => injectToken(html, token),
  };
};

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), studioServer()],
  build: {
    outDir: "dist/client",
    emptyOutDir: true,
    // A local tool (RF-STU-18): the limit of the game's bundle (RNF-03) does not apply.
    chunkSizeWarningLimit: 2048,
  },
  // Only the dev server: pnpm studio serves no inline scripts and its CSP has no nonce (S9).
  ...(command === "serve" ? { html: { cspNonce: nonce } } : {}),
  server: {
    // S1: loopback only, on the port of STUDIO_PORT; if it is taken, fail instead of moving.
    host: HOST,
    port: config.port,
    strictPort: true,
    // S4: no CORS headers.
    cors: false,
    // S2 is enforced by the middleware above; Vite's own check stays with its defaults.
    allowedHosts: [],
    // No /@fs/ outside the repo; Vite's deny list (.env, certificates, .git) stays.
    fs: { strict: true, allow: [REPO_ROOT] },
  },
  preview: { host: HOST, port: config.port, strictPort: true, cors: false },
}));
