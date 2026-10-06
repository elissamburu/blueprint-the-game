// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, SharedRule } from "../types.js";

/** Case- and accent-insensitive, with blanks collapsed: «Región» and «region» are the same. */
export const plainNameKey = (plainName: string): string =>
  plainName
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Two cards with the same simple name could not be told apart in a level 0 palette. */
export const c013: SharedRule = {
  code: "C013",
  description:
    "Un mismo plainName (sin distinguir mayúsculas ni tildes) no aparece en más de una entrada.",
  check: ({ catalog }) => {
    const owners = new Map<string, string>();
    return catalog.flatMap((entry, i): Issue[] => {
      if (entry.plainName === undefined) return [];
      const key = plainNameKey(entry.plainName);
      const owner = owners.get(key);
      if (owner === undefined) {
        owners.set(key, entry.id);
        return [];
      }
      return [
        {
          code: "C013",
          severity: "warning",
          message: `El plainName "${entry.plainName}" de "${entry.id}" ya lo usa "${owner}": en el nivel 0 las dos tarjetas se verían con el mismo nombre; usá nombres simples distintos.`,
          path: ["catalog", i, "plainName"],
        },
      ];
    });
  },
};
