// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

/** "violates only inside incorrect" is structural: the schema rejects it in answers. */
export const l015: Rule = {
  code: "L015",
  description: "Los violates de incorrect referencian objetivos existentes.",
  check: ({ scenario }) => {
    const objectives = new Set(scenario.objectives.map((objective) => objective.id));
    return slotsOf(scenario).flatMap(({ slot, path }) =>
      slot.incorrect.flatMap((incorrect, j) =>
        (incorrect.violates ?? []).flatMap((objective, k): Issue[] =>
          objectives.has(objective)
            ? []
            : [
                {
                  code: "L015",
                  severity: "error",
                  message: `El incorrect "${incorrect.service}" del casillero "${slot.id}" dice violar el objetivo "${objective}", que no existe en objectives.`,
                  path: [...path, "incorrect", j, "violates", k],
                },
              ],
        ),
      ),
    );
  },
};
