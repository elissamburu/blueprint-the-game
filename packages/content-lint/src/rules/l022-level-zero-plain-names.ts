// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { buildPalette } from "@blueprint/scenario-schema";
import { serviceUses } from "../scenario-helpers.js";
import type { Issue, IssuePath, Rule } from "../types.js";

/**
 * At level 0 the cards show the plain name first (ADR-0027 §1, §6), so every entry the player
 * sees needs one: the resolved palette (the same one game-engine builds) and the services of the
 * fixed nodes. Entries missing from the catalog are L002's job. Each entry is reported once, at
 * its first use in the scenario, or at `palette` when only the palette build added it (e.g. a
 * confusion-group mate).
 */
export const l022: Rule = {
  code: "L022",
  description:
    "En el nivel 0, toda entrada de la paleta resuelta y de los nodos fixed tiene plainName.",
  check: ({ scenario, catalog, categories, confusionGroups, gameRules, servicesById }) => {
    if (scenario.level !== 0) return [];
    const palette = buildPalette(scenario, {
      catalog,
      categories,
      confusionGroups,
      rules: gameRules,
    });
    const uses = serviceUses(scenario);
    const fixed = uses.filter((use) => use.kind === "fixed").map((use) => use.service);
    const firstUse = (id: string): IssuePath =>
      uses.find((use) => use.service === id)?.path ?? ["palette"];

    return [...new Set([...palette.services, ...fixed])].flatMap((id): Issue[] => {
      const entry = servicesById.get(id);
      if (entry === undefined || entry.plainName !== undefined) return [];
      return [
        {
          code: "L022",
          severity: "error",
          message: `"${entry.name}" (${id}) se ve en un escenario de nivel 0 pero no tiene plainName en el catálogo: la tarjeta del nivel 0 muestra primero el nombre simple. Agregalo en content/catalog/services.yaml.`,
          path: firstUse(id),
        },
      ];
    });
  },
};
