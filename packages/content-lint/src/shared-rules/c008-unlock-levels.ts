// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { EXPERIENCES, LEVELS } from "@blueprint/scenario-schema";
import type { Issue, SharedRule } from "../types.js";

/** The schema already requires the four experiences, valid levels and ≥ 1 level each. */
export const c008: SharedRule = {
  code: "C008",
  description:
    "Cada experiencia de unlock.byExperience incluye el nivel 100 y sus niveles son contiguos.",
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
              message: `La experiencia "${experience}" no desbloquea el nivel ${LEVELS[0]}: todo jugador tiene que poder empezar por ahí.`,
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
                message: `La experiencia "${experience}" desbloquea hasta el nivel ${highest} pero salta ${holes.join(", ")}: los niveles tienen que ser contiguos.`,
                path,
              },
            ];
      return [...missingFirst, ...gap];
    }),
};
