// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c008 } from "./c008-unlock-levels.js";

describe("C008 unlocked levels by experience", () => {
  it("passes when every experience starts at 100 without gaps, in any order", () => {
    expect(
      runSharedRule(c008, (input) => {
        input.gameRules.unlock.byExperience.architect = [300, 100, 200];
      }),
    ).toEqual([]);
  });

  it("fails when an experience does not include level 100", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience["aws-user"] = [200];
    });
    expect(issues).toEqual([
      {
        code: "C008",
        severity: "error",
        message:
          'La experiencia "aws-user" no desbloquea el nivel 100: todo jugador tiene que poder empezar por ahí.',
        path: ["gameRules", "unlock", "byExperience", "aws-user"],
      },
    ]);
  });

  it("fails when an experience skips levels", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience.expert = [100, 400];
    });
    expect(issues).toEqual([
      {
        code: "C008",
        severity: "error",
        message:
          'La experiencia "expert" desbloquea hasta el nivel 400 pero salta 200, 300: los niveles tienen que ser contiguos.',
        path: ["gameRules", "unlock", "byExperience", "expert"],
      },
    ]);
  });

  it("reports both problems for the same experience", () => {
    const issues = runSharedRule(c008, (input) => {
      input.gameRules.unlock.byExperience.beginner = [300];
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'La experiencia "beginner" no desbloquea el nivel 100: todo jugador tiene que poder empezar por ahí.',
      'La experiencia "beginner" desbloquea hasta el nivel 300 pero salta 200: los niveles tienen que ser contiguos.',
    ]);
  });
});
