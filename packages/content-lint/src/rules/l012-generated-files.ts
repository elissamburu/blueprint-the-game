// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue } from "../types.js";

export interface GeneratedFile {
  /** Repository path, e.g. `content/scenarios/<id>/diagram.mmd`. */
  path: string;
  /** Content `content:gen` would write for the current scenario.yaml. */
  expected: string;
  /** Content committed in the repo; `undefined` when the file does not exist. */
  actual: string | undefined;
}

const normalize = (text: string): string => text.replace(/\r\n/g, "\n");

/**
 * L012: generated files (diagram.mmd, README.md) match what the generator produces.
 * Pure comparison: the CLI reads the files and runs the generator. Line endings are
 * ignored so a Windows checkout with CRLF does not fail.
 */
export const checkGeneratedFiles = (files: readonly GeneratedFile[]): Issue[] =>
  files.flatMap(({ path, expected, actual }): Issue[] => {
    if (actual === undefined) {
      return [
        {
          code: "L012",
          severity: "error",
          message: `Falta el archivo generado ${path}: corré pnpm content:gen.`,
          path: [path],
        },
      ];
    }
    return normalize(actual) === normalize(expected)
      ? []
      : [
          {
            code: "L012",
            severity: "error",
            message: `${path} no coincide con scenario.yaml: es un archivo generado, no se edita a mano. Corré pnpm content:gen.`,
            path: [path],
          },
        ];
  });
