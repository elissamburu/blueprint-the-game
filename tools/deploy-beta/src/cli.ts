// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Command line of the beta site tools (pnpm build:beta, pnpm preview:beta). `main` never throws
// and never prints stack traces: it returns the exit code.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { assemble, AssembleError } from "./assemble.js";
import { UnknownContentTypeError } from "./headers.js";
import { startPreview } from "./preview.js";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface CliDeps {
  repoRoot: string;
}

export const USAGE = `Uso:
  pnpm build:beta
      Build de producción de la beta: baja los íconos, genera el bundle de contenido
      (escenarios beta y published, nunca draft), compila la web y deja en dist/beta-site
      todo lo que va al bucket: la app, /content e /icons.
  pnpm preview:beta [--port <puerto>]
      Sirve dist/beta-site en http://127.0.0.1:<puerto> (por defecto 4319) como lo hace
      CloudFront: con la misma función que reescribe las rutas del juego a /index.html y con
      los headers de cada archivo.
`;

const OPTIONS = {
  help: { type: "boolean", short: "h" },
  port: { type: "string" },
} as const;

type OptionName = keyof typeof OPTIONS;

const ALLOWED: Record<string, readonly OptionName[]> = {
  assemble: ["help"],
  preview: ["port", "help"],
};

const DEFAULT_PORT = 4319;

class UsageError extends Error {}

export const sitePaths = (repoRoot: string) => ({
  webDist: path.join(repoRoot, "apps", "web", "dist"),
  contentDir: path.join(repoRoot, "dist", "content"),
  siteDir: path.join(repoRoot, "dist", "beta-site"),
});

const run = async (argv: readonly string[], io: CliIo, deps: CliDeps): Promise<number> => {
  // `pnpm <script> -- <args>` may forward the `--` separator: it is not an argument here.
  const args = argv.filter((arg) => arg !== "--");
  let parsed;
  try {
    parsed = parseArgs({ args, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError(error instanceof Error ? error.message : String(error));
  }
  const { values, positionals } = parsed;
  const [command, ...rest] = positionals;
  if (command === undefined || values.help === true) {
    io.stdout(USAGE);
    return command === undefined && values.help !== true ? 2 : 0;
  }
  const allowed = ALLOWED[command];
  if (allowed === undefined) throw new UsageError(`Comando desconocido: "${command}".`);
  for (const name of Object.keys(values) as OptionName[]) {
    if (!allowed.includes(name))
      throw new UsageError(`La opción --${name} no aplica a ${command}.`);
  }
  if (rest.length > 0)
    throw new UsageError(`Argumentos de más para ${command}: ${rest.join(" ")}.`);

  const paths = sitePaths(deps.repoRoot);
  const shown = (target: string) => path.relative(deps.repoRoot, target).split(path.sep).join("/");

  switch (command) {
    case "assemble": {
      const result = await assemble({ ...paths, outDir: paths.siteDir });
      const byStatus = new Map<string, number>();
      for (const { status } of result.scenarios) {
        byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
      }
      const statuses = [...byStatus].map(([status, count]) => `${count} ${status}`).join(", ");
      io.stdout(
        `OK: sitio en ${shown(result.outDir)} (${result.files.length} archivos; ${result.scenarios.length} escenario/s: ${statuses}; ${result.icons} ícono/s).\n`,
      );
      return 0;
    }
    default: {
      const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new UsageError(`--port tiene que ser un puerto (recibido: "${values.port}").`);
      }
      await startPreview({ siteDir: paths.siteDir, port });
      io.stdout(
        `Sirviendo ${shown(paths.siteDir)} en http://127.0.0.1:${port} (Ctrl+C para terminar).\n`,
      );
      return 0;
    }
  }
};

export const main = async (
  argv: readonly string[],
  io: CliIo,
  deps: CliDeps = { repoRoot: REPO_ROOT },
): Promise<number> => {
  try {
    return await run(argv, io, deps);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${USAGE}`);
      return 2;
    }
    if (error instanceof AssembleError || error instanceof UnknownContentTypeError) {
      io.stderr(`Error: ${error.message}\n`);
      return 1;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Error: ${message}\n`);
    return 1;
  }
};
