// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l009 } from "./l009-slot-count-by-level.js";

describe("L009 slot count by level", () => {
  it("passes within the recommended range", () => {
    expect(runRule(l009)).toEqual([]);
  });

  it("warns when there are too few slots for the level", () => {
    const issues = runRule(l009, (scenario) => {
      scenario.level = 300;
    });
    expect(issues).toEqual([
      {
        code: "L009",
        severity: "warning",
        message: "El escenario tiene 2 casilleros; para el nivel 300 se recomiendan entre 6 y 10.",
        path: ["diagram", "nodes"],
      },
    ]);
  });

  it("warns when there are too many slots for the level", () => {
    const issues = runRule(l009, (scenario) => {
      const slot = scenario.diagram.nodes[1]!;
      for (let i = 0; i < 3; i++) scenario.diagram.nodes.push({ ...slot, id: `extra-${i}` });
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      "El escenario tiene 5 casilleros; para el nivel 100 se recomiendan entre 2 y 4.",
    ]);
  });

  it("uses the singular for one slot", () => {
    const issues = runRule(l009, (scenario) => {
      scenario.diagram.nodes.splice(2, 1);
    });
    expect(issues[0]?.message).toBe(
      "El escenario tiene 1 casillero; para el nivel 100 se recomiendan entre 2 y 4.",
    );
  });
});
