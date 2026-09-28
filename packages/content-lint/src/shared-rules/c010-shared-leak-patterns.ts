// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** Case-insensitive, like L005. Repeats inside the same service are not reported. */
export const c010: SharedRule = {
  code: "C010",
  description: "Un mismo leakPattern (sin distinguir mayúsculas) no aparece en más de un servicio.",
  check: ({ catalog }) => {
    const owners = new Map<string, string>();
    return catalog.flatMap((service, i) =>
      service.leakPatterns.flatMap((pattern, j): Issue[] => {
        const key = pattern.toLowerCase();
        const owner = owners.get(key);
        if (owner === undefined) {
          owners.set(key, service.id);
          return [];
        }
        return owner === service.id
          ? []
          : [
              {
                code: "C010",
                severity: "warning",
                message: `El patrón "${pattern}" de "${service.id}" ya lo usa "${owner}": L005 no puede distinguir cuál de los dos filtra; usá patrones más específicos.`,
                path: ["catalog", i, "leakPatterns", j],
              },
            ];
      }),
    );
  },
};
