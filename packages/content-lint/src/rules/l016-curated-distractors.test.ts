// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l016 } from "./l016-curated-distractors.js";

describe("L016 curated palette distractors", () => {
  it("passes with 3 distractors (incorrect, extra and confusion groups)", () => {
    expect(runRule(l016)).toEqual([]);
  });

  it("warns with fewer than 3 distractors", () => {
    const issues = runRule(l016, (scenario) => {
      delete scenario.palette;
    });
    expect(issues).toEqual([
      {
        code: "L016",
        severity: "warning",
        message:
          "La paleta curated tiene 2 distractores; se recomiendan al menos 3. Sumá incorrect, palette.extra o grupos de confusión.",
        path: ["palette"],
      },
    ]);
  });

  it("counts only the distractors that fit in maxSize", () => {
    const issues = runRule(l016, (scenario) => {
      scenario.palette = { mode: "curated", maxSize: 4, extra: ["dynamodb"] };
    });
    expect(issues).toEqual([
      {
        code: "L016",
        severity: "warning",
        message:
          "La paleta curated tiene 1 distractor (2 distractores quedaron afuera por maxSize 4); se recomiendan al menos 3. Sumá incorrect, palette.extra o grupos de confusión.",
        path: ["palette", "maxSize"],
      },
    ]);
  });

  it("fails when the answers alone exceed maxSize", () => {
    const issues = runRule(l016, (scenario) => {
      scenario.palette = { mode: "curated", maxSize: 2, extra: [] };
    });
    expect(issues).toEqual([
      {
        code: "L016",
        severity: "error",
        message:
          "La paleta curated admite 2 servicios, pero el escenario tiene 3 respuestas distintas: subí palette.maxSize o reducí respuestas.",
        path: ["palette", "maxSize"],
      },
    ]);
  });

  it("does not apply when the resolved mode is not curated", () => {
    expect(
      runRule(l016, (scenario) => {
        scenario.level = 200;
        scenario.palette = { mode: "auto", extra: [] };
      }),
    ).toEqual([]);
    expect(
      runRule(l016, (scenario) => {
        scenario.palette = { mode: "full", extra: [] };
      }),
    ).toEqual([]);
  });

  it("applies to any level whose mode resolves to curated", () => {
    const explicit = runRule(l016, (scenario) => {
      scenario.level = 300;
      scenario.palette = { mode: "curated", extra: [] };
    });
    expect(explicit.map((issue) => issue.severity)).toEqual(["warning"]);
    const byGameRules = runRule(l016, (scenario, input) => {
      scenario.level = 200;
      scenario.palette = { mode: "auto", extra: [] };
      input.gameRules = {
        ...input.gameRules,
        palette: {
          ...input.gameRules.palette,
          modeByLevel: { ...input.gameRules.palette.modeByLevel, "200": "curated" },
        },
      };
    });
    expect(byGameRules.map((issue) => issue.severity)).toEqual(["warning"]);
  });
});
