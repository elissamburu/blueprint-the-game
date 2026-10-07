// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c008 } from "./c008-unlock-levels.js";

const missingZero = (experience: string) =>
  `La experiencia "${experience}" no desbloquea el nivel 0: ningún nivel anterior lo abre, así que sus escenarios quedarían bloqueados para siempre. Sumá 0 a sus niveles.`;

describe("C008 unlocked levels by experience", () => {
  it("passes when every experience starts at 0 without gaps, in any order", () => {
    expect(
      runSharedRule(c008, (input) => {
        input.gameRules.unlock.byExperience.architect = [300, 0, 100, 200];
      }),
    ).toEqual([]);
  });

  it("fails when an experience does not include level 0, even if it starts at 100", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience["aws-user"] = [100, 200];
    });
    expect(issues).toEqual([
      {
        code: "C008",
        severity: "error",
        message: missingZero("aws-user"),
        path: ["gameRules", "unlock", "byExperience", "aws-user"],
      },
    ]);
  });

  it("fails when an experience skips levels", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience.expert = [0, 100, 400];
    });
    expect(issues).toEqual([
      {
        code: "C008",
        severity: "error",
        message:
          'La experiencia "expert" desbloquea hasta el nivel 400 pero salta 200, 300: los niveles tienen que ser contiguos, desde el 0 sin saltos.',
        path: ["gameRules", "unlock", "byExperience", "expert"],
      },
    ]);
  });

  it("reports both problems for the same experience", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience.beginner = [300];
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      missingZero("beginner"),
      'La experiencia "beginner" desbloquea hasta el nivel 300 pero salta 100, 200: los niveles tienen que ser contiguos, desde el 0 sin saltos.',
    ]);
  });
});
