// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { checkGeneratedFiles } from "./l012-generated-files.js";

const path = "content/scenarios/club-photos/diagram.mmd";

describe("L012 generated files in sync", () => {
  it("passes when the committed file matches the generated one", () => {
    expect(
      checkGeneratedFiles([{ path, expected: "flowchart LR\n", actual: "flowchart LR\n" }]),
    ).toEqual([]);
  });

  it("ignores CRLF line endings", () => {
    expect(checkGeneratedFiles([{ path, expected: "a\nb\n", actual: "a\r\nb\r\n" }])).toEqual([]);
  });

  it("fails when the file differs", () => {
    expect(checkGeneratedFiles([{ path, expected: "a\n", actual: "b\n" }])).toEqual([
      {
        code: "L012",
        severity: "error",
        message: `${path} no coincide con scenario.yaml: es un archivo generado, no se edita a mano. Corré pnpm content:gen.`,
        path: [path],
      },
    ]);
  });

  it("fails when the file is missing", () => {
    expect(checkGeneratedFiles([{ path, expected: "a\n", actual: undefined }])).toEqual([
      {
        code: "L012",
        severity: "error",
        message: `Falta el archivo generado ${path}: corré pnpm content:gen.`,
        path: [path],
      },
    ]);
  });
});
