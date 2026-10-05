// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// `pnpm studio`: serves the built UI and the API on http://127.0.0.1:<port>. It prints the URL,
// never the token (S12).
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CLIENT_DIR, ConfigError, readConfig } from "./config.js";
import { errorCode } from "./fs.js";
import { consoleLog, type Log } from "./log.js";
import { createToken } from "./security.js";
import { startServer, type RunningServer } from "./server.js";

export interface RunOptions {
  env?: Record<string, string | undefined>;
  log?: Log;
  clientDir?: string;
}

const exists = (target: string) =>
  stat(target).then(
    () => true,
    () => false,
  );

/** Starts the Studio. Returns the running server, or `undefined` after printing why it could not start. */
export const run = async ({
  env = process.env,
  log = consoleLog(),
  clientDir = CLIENT_DIR,
}: RunOptions = {}): Promise<RunningServer | undefined> => {
  let config;
  try {
    config = readConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      log.error(error.message);
      return undefined;
    }
    throw error;
  }
  let indexHtml: string;
  try {
    indexHtml = await readFile(path.join(clientDir, "index.html"), "utf8");
  } catch {
    log.error(`Falta el build de la UI en ${clientDir}: corré pnpm studio desde la raíz del repo.`);
    return undefined;
  }
  if (!(await exists(path.join(config.contentDir, "scenarios")))) {
    log.error(`No existe ${path.join(config.contentDir, "scenarios")}: revisá STUDIO_CONTENT_DIR.`);
    return undefined;
  }

  let server: RunningServer;
  try {
    server = await startServer({
      port: config.port,
      token: createToken(),
      contentDir: config.contentDir,
      iconsDir: config.iconsDir,
      gitConfigFiles: config.gitConfigFiles,
      log,
      client: { indexHtml, assetsDir: path.join(clientDir, "assets") },
    });
  } catch (error) {
    log.error(
      errorCode(error) === "EADDRINUSE"
        ? `El puerto ${config.port} está ocupado: cerrá el otro proceso o usá otro con STUDIO_PORT.`
        : `No se pudo iniciar el Studio: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
  log.info(`Blueprint Studio: ${server.url}`);
  log.info(`Contenido: ${config.contentDir}`);
  if (!(await exists(config.iconsDir))) {
    log.info("Sin íconos de servicios: corré pnpm icons:fetch para verlos.");
  }
  log.info("Ctrl+C para salir.");
  return server;
};
