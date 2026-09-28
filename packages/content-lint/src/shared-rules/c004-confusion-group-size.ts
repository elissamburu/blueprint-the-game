// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { plural } from "../scenario-helpers.js";
import type { Issue, SharedRule } from "../types.js";

/**
 * The schema already requires ≥ 2 entries per group; this rule rejects repeated services,
 * so that every group has ≥ 2 distinct services.
 */
export const c004: SharedRule = {
  code: "C004",
  description: "Un grupo de confusión no repite servicios y tiene al menos dos distintos.",
  check: ({ confusionGroups }) =>
    confusionGroups.flatMap((group, i) => {
      const seen = new Set<string>();
      const repeated = group.services.flatMap((service, j): Issue[] => {
        const duplicated = seen.has(service);
        seen.add(service);
        return duplicated
          ? [
              {
                code: "C004",
                severity: "error",
                message: `El grupo de confusión "${group.id}" repite el servicio "${service}".`,
                path: ["confusionGroups", i, "services", j],
              },
            ]
          : [];
      });
      const tooSmall: Issue[] =
        seen.size < 2
          ? [
              {
                code: "C004",
                severity: "error",
                message: `El grupo de confusión "${group.id}" tiene ${plural(seen.size, "servicio distinto", "servicios distintos")}: necesita al menos dos.`,
                path: ["confusionGroups", i, "services"],
              },
            ]
          : [];
      return [...repeated, ...tooSmall];
    }),
};
