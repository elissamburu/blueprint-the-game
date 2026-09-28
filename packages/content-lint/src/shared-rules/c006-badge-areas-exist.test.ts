// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c006 } from "./c006-badge-areas-exist.js";

describe("C006 badge areas exist", () => {
  it("passes when every referenced area exists", () => {
    expect(runSharedRule(c006)).toEqual([]);
  });

  it("fails for complete_count and area_mastery with unknown areas", () => {
    const issues = runSharedRule(c006, (input) => {
      input.areas = [];
    });
    expect(issues).toEqual([
      {
        code: "C006",
        severity: "error",
        message:
          'La insignia "serverless-300" referencia el área "serverless", que no existe en areas.yaml.',
        path: ["badges", 1, "rule", "area"],
      },
      {
        code: "C006",
        severity: "error",
        message:
          'La insignia "maestro-datos" referencia el área "data", que no existe en areas.yaml.',
        path: ["badges", 2, "rule", "area"],
      },
    ]);
  });
});
