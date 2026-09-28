// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

export const c003: SharedRule = {
  code: "C003",
  description: "Cada servicio de un grupo de confusión existe en el catálogo.",
  check: ({ catalog, confusionGroups }) => {
    const serviceIds = new Set(catalog.map((service) => service.id));
    return confusionGroups.flatMap((group, i) =>
      group.services.flatMap((service, j): Issue[] =>
        serviceIds.has(service)
          ? []
          : [
              {
                code: "C003",
                severity: "error",
                message: `El grupo de confusión "${group.id}" incluye "${service}", que no existe en catalog/services.yaml.`,
                path: ["confusionGroups", i, "services", j],
              },
            ],
      ),
    );
  },
};
