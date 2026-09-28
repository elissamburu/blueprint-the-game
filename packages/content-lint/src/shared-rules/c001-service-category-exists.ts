// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

export const c001: SharedRule = {
  code: "C001",
  description: "La categoría de cada servicio del catálogo existe en categories.yaml.",
  check: ({ catalog, categories }) => {
    const categoryIds = new Set(categories.map((category) => category.id));
    return catalog.flatMap((service, i): Issue[] =>
      categoryIds.has(service.category)
        ? []
        : [
            {
              code: "C001",
              severity: "error",
              message: `El servicio "${service.id}" tiene la categoría "${service.category}", que no existe en catalog/categories.yaml.`,
              path: ["catalog", i, "category"],
            },
          ],
    );
  },
};
