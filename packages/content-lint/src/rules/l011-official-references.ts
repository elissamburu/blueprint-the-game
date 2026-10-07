// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { OFFICIAL_DOC_HOSTS, isOfficialReference } from "@blueprint/scenario-schema";
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

// The hosts live in scenario-schema, which also checks `analogyLimit.references` with them.
export { OFFICIAL_DOC_HOSTS, isOfficialReference };

export const l011: Rule = {
  code: "L011",
  description: "Cada optimal tiene al menos una referencia a documentación oficial de AWS.",
  check: ({ scenario }) =>
    slotsOf(scenario).flatMap(({ slot, path }) =>
      slot.answers.flatMap((answer, j): Issue[] =>
        answer.grade !== "optimal" || answer.references.some(isOfficialReference)
          ? []
          : [
              {
                code: "L011",
                severity: "warning",
                message: `La respuesta optimal "${answer.service}" del casillero "${slot.id}" no tiene referencias a documentación oficial (${OFFICIAL_DOC_HOSTS.join(" o ")}).`,
                path: [...path, "answers", j, "references"],
              },
            ],
      ),
    ),
};
