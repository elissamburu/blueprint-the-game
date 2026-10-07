// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

/**
 * Level 0 teaches with analogies, so every answer that teaches (optimal or acceptable) says where
 * its analogy breaks (ADR-0027 §2). The schema already requires ≥ 1 official reference in it.
 */
export const l021: Rule = {
  code: "L021",
  description: "En el nivel 0, toda respuesta optimal o acceptable tiene analogyLimit.",
  check: ({ scenario }) =>
    scenario.level !== 0
      ? []
      : slotsOf(scenario).flatMap(({ slot, path }) =>
          slot.answers.flatMap((answer, j): Issue[] =>
            answer.analogyLimit !== undefined
              ? []
              : [
                  {
                    code: "L021",
                    severity: "error",
                    message: `La respuesta ${answer.grade} "${answer.service}" del casillero "${slot.id}" no tiene analogyLimit: en el nivel 0 cada respuesta explica dónde se rompe la analogía, con al menos una referencia oficial.`,
                    path: [...path, "answers", j],
                  },
                ],
          ),
        ),
};
