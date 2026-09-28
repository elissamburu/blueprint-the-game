// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l003 } from "./l003-slot-has-optimal.js";

describe("L003 every slot has an optimal answer", () => {
  it("passes when each slot has an optimal", () => {
    expect(runRule(l003)).toEqual([]);
  });

  it("fails for a slot with only acceptable answers", () => {
    const issues = runRule(l003, (scenario) => {
      slotById(scenario, "thumbnailer").answers[0]!.grade = "acceptable";
    });
    expect(issues).toEqual([
      {
        code: "L003",
        severity: "error",
        message:
          'El casillero "thumbnailer" no tiene ninguna respuesta optimal: todas son acceptable.',
        path: ["diagram", "nodes", 2, "answers"],
      },
    ]);
  });
});
