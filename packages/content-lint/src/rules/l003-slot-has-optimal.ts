// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotsOf } from "../scenario-helpers.js";
import type { Rule } from "../types.js";

export const l003: Rule = {
  code: "L003",
  description: "Cada casillero tiene al menos una respuesta optimal.",
  check: ({ scenario }) =>
    slotsOf(scenario)
      .filter(({ slot }) => !slot.answers.some((answer) => answer.grade === "optimal"))
      .map(({ slot, path }) => ({
        code: "L003",
        severity: "error",
        message: `El casillero "${slot.id}" no tiene ninguna respuesta optimal: todas son acceptable.`,
        path: [...path, "answers"],
      })),
};
