// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Configuration of the Studio server, from environment variables. The host is not configurable
// (S1): only the port and the content folder are.
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";

/** S1: the server listens only on loopback. A constant on purpose: no option or variable changes it. */
export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4320;

export const REPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));
/** Built UI (`vite build`), served by `pnpm studio`. */
export const CLIENT_DIR = fileURLToPath(new URL("../dist/client", import.meta.url));
/** Icons downloaded by pnpm icons:fetch (ADR-0012), served under /icons/<id>.svg. */
export const ICONS_DIR = path.join(REPO_ROOT, "apps", "web", "public", "icons");

export interface StudioConfig {
  port: number;
  /** Content folder the server reads and writes: `<repo>/content` unless STUDIO_CONTENT_DIR says otherwise. */
  contentDir: string;
  iconsDir: string;
}

export class ConfigError extends Error {}

const PortSchema = z.coerce.number().int().min(1).max(65_535);

export const readConfig = (env: Record<string, string | undefined> = process.env): StudioConfig => {
  let port = DEFAULT_PORT;
  if (env.STUDIO_PORT !== undefined && env.STUDIO_PORT !== "") {
    const parsed = PortSchema.safeParse(env.STUDIO_PORT);
    if (!parsed.success) {
      throw new ConfigError(
        `STUDIO_PORT tiene que ser un número de puerto entre 1 y 65535 (vale "${env.STUDIO_PORT}").`,
      );
    }
    port = parsed.data;
  }
  // Root scripts run from apps/studio; INIT_CWD is where the author invoked pnpm.
  const cwd = env.INIT_CWD ?? process.cwd();
  const contentDir =
    env.STUDIO_CONTENT_DIR === undefined || env.STUDIO_CONTENT_DIR === ""
      ? path.join(REPO_ROOT, "content")
      : path.resolve(cwd, env.STUDIO_CONTENT_DIR);
  return { port, contentDir, iconsDir: ICONS_DIR };
};
