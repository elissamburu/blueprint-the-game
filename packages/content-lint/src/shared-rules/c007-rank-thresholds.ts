// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** The schema already requires ≥ 1 rank and integer minXp ≥ 0. */
export const c007: SharedRule = {
  code: "C007",
  description:
    "Los rangos empiezan en minXp 0 y están ordenados por minXp estrictamente creciente.",
  check: ({ gameRules }) => {
    const { ranks } = gameRules;
    const first = ranks[0];
    const start: Issue[] =
      first !== undefined && first.minXp !== 0
        ? [
            {
              code: "C007",
              severity: "error",
              message: `El primer rango ("${first.id}") tiene minXp ${first.minXp}: tiene que ser 0 para que todo jugador tenga un rango.`,
              path: ["gameRules", "ranks", 0, "minXp"],
            },
          ]
        : [];
    const order = ranks.flatMap((rank, i): Issue[] => {
      const previous = ranks[i - 1];
      return previous === undefined || rank.minXp > previous.minXp
        ? []
        : [
            {
              code: "C007",
              severity: "error",
              message: `El rango "${rank.id}" tiene minXp ${rank.minXp}, que no es mayor que el de "${previous.id}" (${previous.minXp}): ordená los rangos por minXp creciente, sin repetir umbrales.`,
              path: ["gameRules", "ranks", i, "minXp"],
            },
          ];
    });
    return [...start, ...order];
  },
};
