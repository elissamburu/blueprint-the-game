// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** Levels in badge rules (`level`, `minLevel`) are already restricted by the schema. */
export const c006: SharedRule = {
  code: "C006",
  description: "Las áreas que nombran las reglas de insignias existen en areas.yaml.",
  check: ({ areas, badges }) => {
    const areaIds = new Set(areas.map((area) => area.id));
    return badges.flatMap((badge, i): Issue[] => {
      const { rule } = badge;
      const area =
        rule.type === "complete_count" || rule.type === "area_mastery" ? rule.area : undefined;
      return area === undefined || areaIds.has(area)
        ? []
        : [
            {
              code: "C006",
              severity: "error",
              message: `La insignia "${badge.id}" referencia el área "${area}", que no existe en areas.yaml.`,
              path: ["badges", i, "rule", "area"],
            },
          ];
    });
  },
};
