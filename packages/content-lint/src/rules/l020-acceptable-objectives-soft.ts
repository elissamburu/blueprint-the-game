// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

/**
 * In an `acceptable`, `objectives` are the goals it meets only partially (docs/03 §2): a hard
 * restriction is either met or violated, never half met. Unknown ids are L004's job.
 */
export const l020: Rule = {
  code: "L020",
  description: "Los objectives de una respuesta acceptable son solo objetivos soft.",
  check: ({ scenario }) => {
    const hard = new Set(
      scenario.objectives.filter((objective) => objective.kind === "hard").map((o) => o.id),
    );
    return slotsOf(scenario).flatMap(({ slot, path }) =>
      slot.answers.flatMap((answer, j) =>
        answer.grade !== "acceptable"
          ? []
          : answer.objectives.flatMap((objective, k): Issue[] =>
              hard.has(objective)
                ? [
                    {
                      code: "L020",
                      severity: "error",
                      message: `La respuesta acceptable "${answer.service}" del casillero "${slot.id}" referencia la restricción hard "${objective}". En un acceptable, objectives son las metas que cumple a medias; una restricción no se cumple a medias: si no la cumple, va en incorrect con violates.`,
                      path: [...path, "answers", j, "objectives", k],
                    },
                  ]
                : [],
            ),
      ),
    );
  },
};
