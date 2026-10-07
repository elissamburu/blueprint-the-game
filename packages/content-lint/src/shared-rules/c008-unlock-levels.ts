// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { EXPERIENCES, LEVELS } from "@blueprint/scenario-schema";
import type { Issue, SharedRule } from "../types.js";

/**
 * The schema already requires every experience, valid levels and ≥ 1 level each. The first level
 * (0) has no previous level to open it, so an experience without it would lock its scenarios
 * forever (ADR-0027 §3).
 */
export const c008: SharedRule = {
  code: "C008",
  description: `Cada experiencia de unlock.byExperience incluye el nivel ${LEVELS[0]} y sus niveles son contiguos.`,
  check: ({ gameRules }) =>
    EXPERIENCES.flatMap((experience): Issue[] => {
      const levels = gameRules.unlock.byExperience[experience];
      const path = ["gameRules", "unlock", "byExperience", experience];
      const unlocked = new Set<number>(levels);
      const highest = Math.max(...unlocked);
      const holes = LEVELS.filter(
        (level) => level > LEVELS[0] && level < highest && !unlocked.has(level),
      );
      const missingFirst: Issue[] = unlocked.has(LEVELS[0])
        ? []
        : [
            {
              code: "C008",
              severity: "error",
              message: `La experiencia "${experience}" no desbloquea el nivel ${LEVELS[0]}: ningún nivel anterior lo abre, así que sus escenarios quedarían bloqueados para siempre. Sumá ${LEVELS[0]} a sus niveles.`,
              path,
            },
          ];
      const gap: Issue[] =
        holes.length === 0
          ? []
          : [
              {
                code: "C008",
                severity: "error",
                message: `La experiencia "${experience}" desbloquea hasta el nivel ${highest} pero salta ${holes.join(", ")}: los niveles tienen que ser contiguos, desde el ${LEVELS[0]} sin saltos.`,
                path,
              },
            ];
      return [...missingFirst, ...gap];
    }),
};
