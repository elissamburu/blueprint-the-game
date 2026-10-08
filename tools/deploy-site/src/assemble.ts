// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Last step of pnpm build:site: one directory with everything that goes to the bucket. The web
// build (apps/web/dist) already has /icons, copied by Vite from public/ after icons:fetch; the
// production content bundle (dist/content, without drafts) goes to /content. It checks what a
// broken build would miss, so a deploy never publishes a site without content or icons.
import { cp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseBundleIndex } from "@blueprint/scenario-schema";
import { headersFor } from "./headers.js";
import { listSiteFiles } from "./site-files.js";

export interface AssembleOptions {
  /** Output of `vite build` of apps/web. */
  webDist: string;
  /** Output of `pnpm content:build`. */
  contentDir: string;
  outDir: string;
}

export interface AssembleResult {
  outDir: string;
  /** Keys of the site, sorted. */
  files: string[];
  /** Scenarios listed in content/index.json. */
  scenarios: { id: string; status: string }[];
  icons: number;
}

/** A problem of the build the maintainer can fix: reported without a stack trace. */
export class AssembleError extends Error {}

const exists = async (target: string): Promise<boolean> =>
  stat(target).then(
    () => true,
    () => false,
  );

const readIndex = async (contentDir: string) => {
  const file = path.join(contentDir, "index.json");
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch {
    throw new AssembleError(
      `Falta ${file}. Corré pnpm build:site (genera el bundle de contenido).`,
    );
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new AssembleError(`${file} no es un JSON válido.`);
  }
  const parsed = parseBundleIndex(raw);
  if (!parsed.success) {
    throw new AssembleError(`${file} no es válido:\n${formatIssues(parsed.issues)}`);
  }
  return parsed.data;
};

export const assemble = async (options: AssembleOptions): Promise<AssembleResult> => {
  const webDist = path.resolve(options.webDist);
  const contentDir = path.resolve(options.contentDir);
  const outDir = path.resolve(options.outDir);

  if (!(await exists(path.join(webDist, "index.html")))) {
    throw new AssembleError(
      `Falta ${path.join(webDist, "index.html")}. Corré pnpm build:site (compila la web).`,
    );
  }
  const index = await readIndex(contentDir);
  if (index.scenarios.length === 0) {
    throw new AssembleError(
      "El bundle de contenido no lista ningún escenario: no hay escenarios beta ni published.",
    );
  }
  const drafts = index.scenarios.filter((scenario) => scenario.status === "draft");
  if (drafts.length > 0) {
    throw new AssembleError(
      `El bundle de contenido lista borradores (${drafts.map((d) => d.id).join(", ")}): se generó con --include-drafts. Corré pnpm build:site.`,
    );
  }
  for (const name of ["catalog.json", "game-rules.json", ...index.scenarios.map((s) => s.file)]) {
    if (!(await exists(path.join(contentDir, name)))) {
      throw new AssembleError(`Falta ${path.join(contentDir, name)} en el bundle de contenido.`);
    }
  }

  await rm(outDir, { recursive: true, force: true });
  // .vite/ holds the build manifest (for the size check): it is not part of the site.
  await cp(webDist, outDir, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".vite",
  });
  await cp(contentDir, path.join(outDir, "content"), {
    recursive: true,
    filter: (source) => source === contentDir || source.endsWith(".json"),
  });

  const files = await listSiteFiles(outDir);
  const icons = files.filter((key) => key.startsWith("icons/") && key.endsWith(".svg")).length;
  if (icons === 0) {
    throw new AssembleError(
      "El sitio no tiene íconos en /icons. Corré pnpm build:site: baja los íconos antes de compilar la web.",
    );
  }
  // Fails here, not in the middle of an upload, on a file the deploy has no Content-Type for.
  for (const key of files) headersFor(key);

  return {
    outDir,
    files,
    scenarios: index.scenarios.map(({ id, status }) => ({ id, status })),
    icons,
  };
};
