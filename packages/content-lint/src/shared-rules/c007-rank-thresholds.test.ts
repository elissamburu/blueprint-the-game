// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c007 } from "./c007-rank-thresholds.js";

describe("C007 rank thresholds", () => {
  it("passes for ranks starting at 0 with increasing minXp", () => {
    expect(runSharedRule(c007)).toEqual([]);
  });

  it("fails when the first rank does not start at 0", () => {
    const issues = runSharedRule(c007, (input) => {
      input.gameRules.ranks[0]!.minXp = 100;
    });
    expect(issues).toEqual([
      {
        code: "C007",
        severity: "error",
        message:
          'El primer rango ("aprendiz") tiene minXp 100: tiene que ser 0 para que todo jugador tenga un rango.',
        path: ["gameRules", "ranks", 0, "minXp"],
      },
    ]);
  });

  it("fails for ranks out of order or with repeated thresholds", () => {
    const issues = runSharedRule(c007, (input) => {
      input.gameRules.ranks.push(
        { id: "arquitecto", name: "Arquitecto", minXp: 500 },
        { id: "principal", name: "Principal", minXp: 500 },
      );
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ["gameRules", "ranks", 2, "minXp"],
      ["gameRules", "ranks", 3, "minXp"],
    ]);
    expect(issues[0]?.message).toBe(
      'El rango "arquitecto" tiene minXp 500, que no es mayor que el de "constructor" (1000): ordená los rangos por minXp creciente, sin repetir umbrales.',
    );
  });
});
