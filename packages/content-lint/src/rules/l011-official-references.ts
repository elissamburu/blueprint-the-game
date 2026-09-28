// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

export const OFFICIAL_DOC_HOSTS: readonly string[] = ["docs.aws.amazon.com", "aws.amazon.com"];

/** Exact hostname match; the schema already guarantees an https URL. */
export const isOfficialReference = (url: string): boolean => {
  const host = /^https:\/\/([^/?#:]+)/i.exec(url)?.[1]?.toLowerCase();
  return host !== undefined && OFFICIAL_DOC_HOSTS.includes(host);
};

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
