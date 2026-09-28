// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { buildCuratedPalette, resolvePaletteMode } from "@blueprint/scenario-schema";
import { plural } from "../scenario-helpers.js";
import type { Rule } from "../types.js";

export const MIN_CURATED_DISTRACTORS = 3;

/**
 * Only when the resolved palette mode is `curated`. Counts the distractors that actually
 * make it into the palette built by buildCuratedPalette (after trimming at maxSize).
 */
export const l016: Rule = {
  code: "L016",
  description: `Con paleta curated (resuelta), las respuestas entran en maxSize y hay ≥ ${MIN_CURATED_DISTRACTORS} distractores.`,
  check: ({ scenario, catalog, confusionGroups, gameRules }) => {
    if (resolvePaletteMode(scenario, gameRules) !== "curated") return [];
    const palette = buildCuratedPalette(scenario, catalog, confusionGroups, gameRules);
    const path =
      scenario.palette !== undefined &&
      "maxSize" in scenario.palette &&
      scenario.palette.maxSize !== undefined
        ? ["palette", "maxSize"]
        : ["palette"];
    if (palette.answers.length > palette.maxSize) {
      return [
        {
          code: "L016",
          severity: "error",
          message: `La paleta curated admite ${palette.maxSize} servicios, pero el escenario tiene ${plural(palette.answers.length, "respuesta")} distintas: subí palette.maxSize o reducí respuestas.`,
          path,
        },
      ];
    }
    if (palette.distractors.length >= MIN_CURATED_DISTRACTORS) return [];
    const trimmed =
      palette.dropped.length > 0
        ? ` (${plural(palette.dropped.length, "distractor", "distractores")} quedaron afuera por maxSize ${palette.maxSize})`
        : "";
    return [
      {
        code: "L016",
        severity: "warning",
        message: `La paleta curated tiene ${plural(palette.distractors.length, "distractor", "distractores")}${trimmed}; se recomiendan al menos ${MIN_CURATED_DISTRACTORS}. Sumá incorrect, palette.extra o grupos de confusión.`,
        path,
      },
    ];
  },
};
