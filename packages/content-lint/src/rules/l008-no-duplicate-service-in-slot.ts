// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Issue, IssuePath, Rule } from "../types.js";

export const l008: Rule = {
  code: "L008",
  description: "Un servicio no aparece dos veces en el mismo casillero (answers + incorrect).",
  check: ({ scenario }) =>
    slotsOf(scenario).flatMap(({ slot, path }) => {
      const entries: { service: string; path: IssuePath }[] = [
        ...slot.answers.map((answer, j) => ({
          service: answer.service,
          path: [...path, "answers", j, "service"],
        })),
        ...slot.incorrect.map((incorrect, j) => ({
          service: incorrect.service,
          path: [...path, "incorrect", j, "service"],
        })),
      ];
      const seen = new Set<string>();
      const issues: Issue[] = [];
      for (const entry of entries) {
        if (seen.has(entry.service)) {
          issues.push({
            code: "L008",
            severity: "error",
            message: `El servicio "${entry.service}" aparece más de una vez en el casillero "${slot.id}" (entre answers e incorrect).`,
            path: entry.path,
          });
        }
        seen.add(entry.service);
      }
      return issues;
    }),
};
