// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { serviceUses } from "../scenario-helpers.js";
import type { Rule } from "../types.js";

/** Covers fixed nodes, answers, incorrect and palette.extra. */
export const l002: Rule = {
  code: "L002",
  description: "Todo servicio usado existe en el catálogo.",
  check: ({ scenario, servicesById }) =>
    serviceUses(scenario)
      .filter((use) => !servicesById.has(use.service))
      .map((use) => ({
        code: "L002",
        severity: "error",
        message: `El servicio "${use.service}" no existe en el catálogo (content/catalog/services.yaml).`,
        path: use.path,
      })),
};
