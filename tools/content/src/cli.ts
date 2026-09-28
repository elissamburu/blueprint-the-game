// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Command line of content:validate, content:gen and content:build. `main` never throws and
// never prints stack traces: it returns the exit code.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { build } from "./build.js";
import { formatFinding, formatValidationText } from "./report.js";
import { generate } from "./gen.js";
import { validate } from "./validate.js";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

export interface CliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface CliDefaults {
  contentDir: string;
  outDir: string;
  /** Directory relative --content and --out paths resolve against. */
  cwd: string;
}

const processIo: CliIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

const DEFAULTS: CliDefaults = {
  contentDir: path.join(REPO_ROOT, "content"),
  outDir: path.join(REPO_ROOT, "dist", "content"),
  // pnpm runs the root scripts from tools/content; INIT_CWD is where the user invoked pnpm.
  cwd: process.env.INIT_CWD ?? process.cwd(),
};

export const USAGE = `Uso:
  pnpm content:validate [-- <id>] [--base <ref>] [--format text|json]
      Schema y lint semántico de content/ (todos los escenarios o solo <id>).
      --base <ref>   compara version contra esa ref de git (L014), p. ej. origin/main.
      --format json  imprime el reporte en JSON (para el Studio y CI).
  pnpm content:gen [--check]
      Genera diagram.mmd y README.md de cada escenario. Con --check no escribe:
      falla si alguno falta o está desactualizado.
  pnpm content:build [--out <dir>]
      Genera el bundle JSON en dist/content (falla si content:validate tiene errores).

Opción común: --content <dir> usa otro directorio de contenido (por defecto content/).
`;

const OPTIONS = {
  base: { type: "string" },
  check: { type: "boolean" },
  content: { type: "string" },
  format: { type: "string" },
  help: { type: "boolean", short: "h" },
  out: { type: "string" },
} as const;

type OptionName = keyof typeof OPTIONS;

const ALLOWED: Record<string, readonly OptionName[]> = {
  validate: ["base", "content", "format", "help"],
  gen: ["check", "content", "help"],
  build: ["content", "out", "help"],
};

class UsageError extends Error {}

const shownPath = (target: string): string => {
  const relative = path.relative(REPO_ROOT, target);
  return relative.startsWith("..") || path.isAbsolute(relative)
    ? target
    : relative.split(path.sep).join("/");
};

const run = async (argv: readonly string[], io: CliIo, defaults: CliDefaults): Promise<number> => {
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
    if (!allowed.includes(name)) throw new UsageError(`La opción --${name} no aplica a ${command}.`);
  }
  const maxPositionals = command === "validate" ? 1 : 0;
  if (rest.length > maxPositionals) {
    throw new UsageError(`Argumentos de más para ${command}: ${rest.join(" ")}.`);
  }
  const contentDir = path.resolve(defaults.cwd, values.content ?? defaults.contentDir);

  switch (command) {
    case "validate": {
      const format = values.format ?? "text";
      if (format !== "text" && format !== "json") {
        throw new UsageError(`--format tiene que ser "text" o "json" (recibido: "${format}").`);
      }
      const [id] = rest;
      const report = await validate({
        contentDir,
        ...(id === undefined ? {} : { id }),
        ...(values.base === undefined ? {} : { base: values.base }),
      });
      io.stdout(
        format === "json" ? `${JSON.stringify(report, null, 2)}\n` : formatValidationText(report),
      );
      return report.ok ? 0 : 1;
    }
    case "gen": {
      const check = values.check === true;
      const result = await generate({ contentDir, check });
      const lines = result.findings.map((finding) => formatFinding(finding));
      if (!check) lines.push(...result.changed.map((file) => `  escrito ${file}`));
      if (result.ok) {
        lines.push(
          check
            ? `OK: ${result.unchanged.length} archivo/s generado/s al día.`
            : `OK: ${result.changed.length} archivo/s escrito/s, ${result.unchanged.length} sin cambios.`,
        );
      } else {
        lines.push(
          check
            ? "FALLÓ: hay archivos generados faltantes o desactualizados. Corré pnpm content:gen."
            : "FALLÓ: no se pudieron generar todos los archivos.",
        );
      }
      io.stdout(`${lines.join("\n")}\n`);
      return result.ok ? 0 : 1;
    }
    default: {
      const result = await build({
        contentDir,
        outDir: path.resolve(defaults.cwd, values.out ?? defaults.outDir),
      });
      if (!result.ok) {
        io.stdout(formatValidationText(result.report));
        io.stdout("FALLÓ: content:build necesita que content:validate pase sin errores.\n");
        return 1;
      }
      io.stdout(
        `OK: bundle en ${shownPath(result.outDir)} (${result.files.length} archivos; ${result.listed} escenario/s en index.json).\n`,
      );
      return 0;
    }
  }
};

export const main = async (
  argv: readonly string[],
  io: CliIo = processIo,
  defaults: CliDefaults = DEFAULTS,
): Promise<number> => {
  try {
    return await run(argv, io, defaults);
  } catch (error) {
    if (error instanceof UsageError) {
      io.stderr(`${error.message}\n\n${USAGE}`);
      return 2;
    }
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`Error: ${message}\n`);
    return 1;
  }
};
