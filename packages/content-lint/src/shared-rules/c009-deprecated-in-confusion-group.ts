// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** buildCuratedPalette never adds a deprecated service as a confusion-group mate (RF-PAL-05). */
export const c009: SharedRule = {
  code: "C009",
  description: "Un grupo de confusión no incluye servicios deprecated.",
  check: ({ catalog, confusionGroups }) => {
    const deprecated = new Set(
      catalog.filter((service) => service.status === "deprecated").map((service) => service.id),
    );
    return confusionGroups.flatMap((group, i) =>
      group.services.flatMap((service, j): Issue[] =>
        deprecated.has(service)
          ? [
              {
                code: "C009",
                severity: "warning",
                message: `El grupo de confusión "${group.id}" incluye "${service}", que está deprecated: la paleta curated no lo agrega como compañero de grupo; revisá si el grupo sigue teniendo sentido.`,
                path: ["confusionGroups", i, "services", j],
              },
            ]
          : [],
      ),
    );
  },
};
