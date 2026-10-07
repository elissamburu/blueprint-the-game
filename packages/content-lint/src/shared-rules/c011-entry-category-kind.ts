// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** Categories missing from categories.yaml are C001's job. */
export const c011: SharedRule = {
  code: "C011",
  description:
    "Un concepto va en una categoría kind: concept y un servicio en una categoría kind: service.",
  check: ({ catalog, categories }) => {
    const kinds = new Map(categories.map((category) => [category.id, category.kind]));
    return catalog.flatMap((entry, i): Issue[] => {
      const kind = kinds.get(entry.category);
      if (kind === undefined || kind === entry.type) return [];
      const what = entry.type === "concept" ? "El concepto" : "El servicio";
      return [
        {
          code: "C011",
          severity: "error",
          message: `${what} "${entry.id}" está en la categoría "${entry.category}", que es kind: ${kind}: usá una categoría kind: ${entry.type}.`,
          path: ["catalog", i, "category"],
        },
      ];
    });
  },
};
