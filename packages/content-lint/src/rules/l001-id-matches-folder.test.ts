// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l001 } from "./l001-id-matches-folder.js";

describe("L001 id matches folder", () => {
  it("passes when the id equals the folder name", () => {
    expect(runRule(l001)).toEqual([]);
  });

  it("fails when the folder has another name", () => {
    const issues = runRule(l001, (_, input) => {
      input.folderName = "club-fotos";
    });
    expect(issues).toEqual([
      {
        code: "L001",
        severity: "error",
        message:
          'El id "club-photos" no coincide con el nombre de la carpeta "club-fotos": tienen que ser iguales.',
        path: ["id"],
      },
    ]);
  });
});
