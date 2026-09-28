// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Scenario } from "@blueprint/scenario-schema";
import { plural, slotsOf } from "../scenario-helpers.js";
import type { Rule } from "../types.js";

export const SLOTS_BY_LEVEL: Record<Scenario["level"], { min: number; max: number }> = {
  100: { min: 2, max: 4 },
  200: { min: 4, max: 7 },
  300: { min: 6, max: 10 },
  400: { min: 8, max: 14 },
};

export const l009: Rule = {
  code: "L009",
  description: "Cantidad de casilleros recomendada según el nivel.",
  check: ({ scenario }) => {
    const count = slotsOf(scenario).length;
    const { min, max } = SLOTS_BY_LEVEL[scenario.level];
    return count >= min && count <= max
      ? []
      : [
          {
            code: "L009",
            severity: "warning",
            message: `El escenario tiene ${plural(count, "casillero")}; para el nivel ${scenario.level} se recomiendan entre ${min} y ${max}.`,
            path: ["diagram", "nodes"],
          },
        ];
  },
};
