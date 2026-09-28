// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, Rule } from "../types.js";

export const l019: Rule = {
  code: "L019",
  description: "Cada área del escenario existe en areas.yaml.",
  check: ({ scenario, areas }) => {
    const areaIds = new Set(areas.map((area) => area.id));
    return scenario.areas.flatMap((area, i): Issue[] =>
      areaIds.has(area)
        ? []
        : [
            {
              code: "L019",
              severity: "error",
              message: `El escenario pertenece al área "${area}", que no existe en areas.yaml.`,
              path: ["areas", i],
            },
          ],
    );
  },
};
