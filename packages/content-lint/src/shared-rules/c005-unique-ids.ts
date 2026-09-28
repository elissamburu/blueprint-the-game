// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { repeatedIdIndexes } from "../ids.js";
import type { Issue, IssuePath, SharedRule } from "../types.js";

const duplicateIds = (
  items: readonly { id: string }[],
  collection: string,
  basePath: IssuePath,
): Issue[] =>
  repeatedIdIndexes(items).map((i) => ({
    code: "C005",
    severity: "error",
    message: `El id "${items[i]?.id}" está repetido en ${collection}: cada id tiene que ser único.`,
    path: [...basePath, i, "id"],
  }));

export const c005: SharedRule = {
  code: "C005",
  description:
    "Ids únicos en servicios, categorías, grupos de confusión, áreas, insignias y rangos.",
  check: ({ catalog, categories, confusionGroups, areas, gameRules, badges }) => [
    ...duplicateIds(catalog, "catalog/services.yaml", ["catalog"]),
    ...duplicateIds(categories, "catalog/categories.yaml", ["categories"]),
    ...duplicateIds(confusionGroups, "catalog/confusion-groups.yaml", ["confusionGroups"]),
    ...duplicateIds(areas, "areas.yaml", ["areas"]),
    ...duplicateIds(badges, "badges/badges.yaml", ["badges"]),
    ...duplicateIds(gameRules.ranks, "los rangos de game-rules.yaml", ["gameRules", "ranks"]),
  ],
};
