// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { serviceUses } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

export const l010: Rule = {
  code: "L010",
  description: "Servicios deprecated: error como optimal, advertencia en cualquier otro uso.",
  check: ({ scenario, servicesById }) =>
    serviceUses(scenario).flatMap((use): Issue[] => {
      const service = servicesById.get(use.service);
      if (service?.status !== "deprecated") return [];
      return [
        use.kind === "optimal"
          ? {
              code: "L010",
              severity: "error",
              message: `${service.name} está deprecated en el catálogo: no puede ser una respuesta optimal.`,
              path: use.path,
            }
          : {
              code: "L010",
              severity: "warning",
              message: `${service.name} está deprecated en el catálogo (usado como ${use.kind}): revisá si sigue teniendo sentido en el escenario.`,
              path: use.path,
            },
      ];
    }),
};
