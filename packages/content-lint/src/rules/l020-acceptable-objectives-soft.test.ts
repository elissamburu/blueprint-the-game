// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l020 } from "./l020-acceptable-objectives-soft.js";

describe("L020 acceptable answers reference soft objectives only", () => {
  it("passes when acceptable answers reference soft objectives", () => {
    expect(runRule(l020)).toEqual([]);
  });

  it("fails for a hard objective in an acceptable answer", () => {
    const issues = runRule(l020, (scenario) => {
      slotById(scenario, "thumbnailer").answers[1]!.objectives = ["low-cost", "no-servers"];
    });
    expect(issues).toEqual([
      {
        code: "L020",
        severity: "error",
        message:
          'La respuesta acceptable "fargate" del casillero "thumbnailer" referencia la restricción hard "no-servers". En un acceptable, objectives son las metas que cumple a medias; una restricción no se cumple a medias: si no la cumple, va en incorrect con violates.',
        path: ["diagram", "nodes", 2, "answers", 1, "objectives", 1],
      },
    ]);
  });

  it("allows hard objectives in optimal answers", () => {
    const issues = runRule(l020, (scenario) => {
      slotById(scenario, "thumbnailer").answers[0]!.objectives = ["no-servers"];
    });
    expect(issues).toEqual([]);
  });

  it("ignores unknown objectives (L004 reports them)", () => {
    const issues = runRule(l020, (scenario) => {
      slotById(scenario, "thumbnailer").answers[1]!.objectives = ["cheap"];
    });
    expect(issues).toEqual([]);
  });
});
