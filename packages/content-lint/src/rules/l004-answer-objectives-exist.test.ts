// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l004 } from "./l004-answer-objectives-exist.js";

describe("L004 answers reference existing objectives", () => {
  it("passes when every objective exists", () => {
    expect(runRule(l004)).toEqual([]);
  });

  it("fails for an unknown objective", () => {
    const issues = runRule(l004, (scenario) => {
      slotById(scenario, "thumbnailer").answers[1]!.objectives = ["no-servers", "cheap"];
    });
    expect(issues).toEqual([
      {
        code: "L004",
        severity: "error",
        message:
          'La respuesta "fargate" del casillero "thumbnailer" referencia el objetivo "cheap", que no existe en objectives.',
        path: ["diagram", "nodes", 2, "answers", 1, "objectives", 1],
      },
    ]);
  });
});
