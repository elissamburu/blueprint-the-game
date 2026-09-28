// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

/**
 * The schema already requires a non-empty rationale and ≥ 1 objective per answer;
 * this rule checks that every referenced objective exists.
 */
export const l004: Rule = {
  code: "L004",
  description: "Cada respuesta optimal/acceptable referencia objetivos existentes.",
  check: ({ scenario }) => {
    const objectives = new Set(scenario.objectives.map((objective) => objective.id));
    return slotsOf(scenario).flatMap(({ slot, path }) =>
      slot.answers.flatMap((answer, j) =>
        answer.objectives.flatMap((objective, k): Issue[] =>
          objectives.has(objective)
            ? []
            : [
                {
                  code: "L004",
                  severity: "error",
                  message: `La respuesta "${answer.service}" del casillero "${slot.id}" referencia el objetivo "${objective}", que no existe en objectives.`,
                  path: [...path, "answers", j, "objectives", k],
                },
              ],
        ),
      ),
    );
  },
};
