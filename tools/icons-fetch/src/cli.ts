// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Command line of pnpm icons:fetch. `main` never throws and never prints stack traces: it
// returns the exit code.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { IconsFetchError } from "./config.js";
import {
  defaultPaths,
  fetchIcons,
  type FetchIconsOptions,
  type FetchIconsResult,
} from "./fetch-icons.js";

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

export const USAGE = `Uso:
  pnpm icons:fetch
      Descarga el paquete oficial de íconos de arquitectura de AWS fijado en
      tools/icons-fetch/icons.config.json (o usa la copia en .cache/aws-icons), verifica su
      SHA-256 y genera apps/web/public/icons/<serviceId>.svg según el campo icon de
      content/catalog/services.yaml. Los íconos no se versionan (ADR-0012).
`;

const shownPath =
  (repoRoot: string) =>
  (target: string): string => {
    const relative = path.relative(repoRoot, target);
    return relative.startsWith("..") || path.isAbsolute(relative)
      ? target
      : relative.split(path.sep).join("/");
  };

/** Human report: warnings for unmapped services, errors for broken mappings. */
export const formatResult = (
  result: FetchIconsResult,
  outDir: string,
): { out: string; err: string } => {
  const { resolution } = result;
  const out: string[] = [];
  const err: string[] = [];
  if (resolution.unmapped.length > 0) {
    out.push(
      `Aviso: ${resolution.unmapped.length} servicio(s) del catálogo sin ícono mapeado (se muestra el fallback por categoría):`,
      ...resolution.unmapped.map((id) => `  - ${id}`),
    );
  }
  if (resolution.missing.length > 0) {
    err.push(
      `Error: ${resolution.missing.length} mapeo(s) apuntan a íconos que no existen en el paquete ${result.release}:`,
      ...resolution.missing.map(({ id, icon }) => `  - ${id}: ${icon}`),
    );
  }
  if (resolution.ambiguous.length > 0) {
    err.push(
      `Error: ${resolution.ambiguous.length} mapeo(s) coinciden con más de un archivo del paquete:`,
      ...resolution.ambiguous.map(
        ({ id, icon, entries }) => `  - ${id}: ${icon} (${entries.join(", ")})`,
      ),
    );
  }
  if (result.written) {
    out.push(`${resolution.resolved.length} ícono(s) del paquete ${result.release} en ${outDir}/.`);
  } else {
    err.push(
      "No se escribió ningún ícono. Corregí el campo icon en content/catalog/services.yaml.",
    );
  }
  const text = (lines: string[]) => (lines.length > 0 ? `${lines.join("\n")}\n` : "");
  return { out: text(out), err: text(err) };
};

export const main = async (
  argv: readonly string[],
  io: CliIo,
  overrides: Partial<Omit<FetchIconsOptions, "log" | "show">> & { repoRoot?: string } = {},
): Promise<number> => {
  try {
    const { values } = parseArgs({
      args: [...argv],
      options: { help: { type: "boolean", short: "h" } },
      strict: true,
    });
    if (values.help === true) {
      io.stdout(USAGE);
      return 0;
    }
  } catch (error) {
    io.stderr(`${(error as Error).message}\n\n${USAGE}`);
    return 2;
  }

  const { repoRoot = REPO_ROOT, ...rest } = overrides;
  const show = shownPath(repoRoot);
  const options: FetchIconsOptions = {
    ...defaultPaths(repoRoot),
    fetch: (url) => fetch(url),
    ...rest,
    log: (line) => io.stdout(`${line}\n`),
    show,
  };
  try {
    const result = await fetchIcons(options);
    const { out, err } = formatResult(result, show(options.outDir));
    io.stdout(out);
    io.stderr(err);
    return result.written ? 0 : 1;
  } catch (error) {
    if (error instanceof IconsFetchError) {
      io.stderr(`Error: ${error.message}\n`);
      return 1;
    }
    io.stderr(`Error inesperado: ${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
};
