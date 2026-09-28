// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// content:gen (RF-CNT-03): writes diagram.mmd and README.md per scenario, or with `check`
// only reports the ones that are missing or out of date.
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { checkGeneratedFiles } from "@blueprint/content-lint";
import type { Service } from "@blueprint/scenario-schema";
import {
  displayPath,
  isDirectory,
  listScenarioIds,
  loadScenario,
  loadSharedContent,
  readTextIfExists,
} from "./content.js";
import type { Finding } from "./findings.js";
import { GENERATED_FILES, renderGeneratedFiles } from "./generate.js";

export interface GenOptions {
  contentDir: string;
  /** Do not write: fail when a generated file is missing or differs. */
  check: boolean;
}

export interface GenResult {
  ok: boolean;
  /** Files written (or, with `check`, that would be written). */
  changed: string[];
  unchanged: string[];
  findings: Finding[];
}

const sameText = (a: string, b: string): boolean =>
  a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

export const generate = async (options: GenOptions): Promise<GenResult> => {
  const contentDir = path.resolve(options.contentDir);
  const result: GenResult = { ok: true, changed: [], unchanged: [], findings: [] };
  const fail = (finding: Finding): GenResult => {
    result.findings.push(finding);
    result.ok = false;
    return result;
  };
  const display = displayPath(contentDir, contentDir);

  if (!(await isDirectory(contentDir))) {
    return fail({
      code: "FILE",
      severity: "error",
      message: `No existe el directorio de contenido ${contentDir}.`,
      file: display,
    });
  }
  const { shared, findings } = await loadSharedContent(contentDir);
  if (shared.services === undefined) {
    // Only the catalog is needed to generate: report just its problems.
    result.findings.push(...findings.filter((f) => f.file.endsWith("catalog/services.yaml")));
    result.ok = false;
    return result;
  }
  const catalog = new Map<string, Service>(shared.services.map((s) => [s.id, s]));

  for (const id of (await listScenarioIds(contentDir)) ?? []) {
    const loaded = await loadScenario(contentDir, id);
    if (loaded.scenario === undefined) {
      fail({
        code: loaded.findings[0]?.code ?? "SCHEMA",
        severity: "error",
        message: `No se generan los archivos de "${id}" porque ${loaded.file} tiene errores: corré pnpm content:validate -- ${id}.`,
        file: loaded.file,
      });
      continue;
    }
    const expected = renderGeneratedFiles(loaded.scenario, catalog);
    for (const name of GENERATED_FILES) {
      const file = path.join(loaded.dir, name);
      const shown = displayPath(contentDir, file);
      const actual = await readTextIfExists(file);
      if (actual !== undefined && sameText(actual, expected[name])) {
        result.unchanged.push(shown);
        continue;
      }
      result.changed.push(shown);
      if (options.check) {
        const issues = checkGeneratedFiles([{ path: shown, expected: expected[name], actual }]);
        for (const issue of issues) {
          fail({ code: issue.code, severity: issue.severity, message: issue.message, file: shown });
        }
      } else {
        await writeFile(file, expected[name], "utf8");
      }
    }
  }
  return result;
};
