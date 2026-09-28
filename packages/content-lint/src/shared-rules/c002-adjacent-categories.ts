// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

export const c002: SharedRule = {
  code: "C002",
  description: "Las categorías adyacentes existen y ninguna categoría es adyacente a sí misma.",
  check: ({ categories }) => {
    const categoryIds = new Set(categories.map((category) => category.id));
    return categories.flatMap((category, i) =>
      category.adjacent.flatMap((adjacent, j): Issue[] => {
        const path = ["categories", i, "adjacent", j];
        if (adjacent === category.id) {
          return [
            {
              code: "C002",
              severity: "error",
              message: `La categoría "${category.id}" se lista como adyacente a sí misma: adjacent solo nombra otras categorías.`,
              path,
            },
          ];
        }
        return categoryIds.has(adjacent)
          ? []
          : [
              {
                code: "C002",
                severity: "error",
                message: `La categoría "${category.id}" tiene como adyacente a "${adjacent}", que no existe en catalog/categories.yaml.`,
                path,
              },
            ];
      }),
    );
  },
};
