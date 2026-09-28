// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Palette of a scenario by resolved mode (RF-PAL-01, RF-PAL-05, docs/01 "Modos de paleta").
// Mode resolution and the curated build live in @blueprint/scenario-schema, shared with the
// lint (L016); this module only picks the mode and adds the category-based modes.
import {
  adjacentCategories,
  buildCuratedPalette,
  resolvePaletteMode,
  type Category,
  type ConcretePaletteMode,
  type ConfusionGroup,
  type GameRules,
  type Scenario,
  type Service,
} from "@blueprint/scenario-schema";

export interface PaletteContent {
  readonly catalog: readonly Pick<Service, "id" | "category" | "status">[];
  readonly categories: readonly Pick<Category, "id" | "adjacent">[];
  readonly confusionGroups: readonly Pick<ConfusionGroup, "services">[];
  readonly rules: Pick<GameRules, "palette">;
}

export interface ScenarioPalette {
  readonly mode: ConcretePaletteMode;
  /** Service ids. `curated` keeps its build order; the other modes follow the catalog order. */
  readonly services: readonly string[];
}

/**
 * - `curated`: `buildCuratedPalette`.
 * - `categories`: every service of the categories of the answers.
 * - `categories-plus`: `categories` plus the adjacent categories.
 * - `full`: the whole catalog.
 * The last three also include the services the scenario uses (answers, `incorrect`,
 * `palette.extra`); `deprecated` services appear only if the scenario uses them (RF-PAL-05).
 */
export const buildPalette = (
  scenario: Pick<Scenario, "level" | "diagram" | "palette">,
  content: PaletteContent,
): ScenarioPalette => {
  const mode = resolvePaletteMode(scenario, content.rules);
  if (mode === "curated") {
    const curated = buildCuratedPalette(
      scenario,
      content.catalog,
      content.confusionGroups,
      content.rules,
    );
    return { mode, services: curated.services };
  }

  const slots = scenario.diagram.nodes.flatMap((node) => (node.type === "slot" ? [node] : []));
  const answers = new Set(slots.flatMap((slot) => slot.answers.map((a) => a.service)));
  const used = new Set([
    ...answers,
    ...slots.flatMap((slot) => slot.incorrect.map((i) => i.service)),
    ...(scenario.palette?.extra ?? []),
  ]);
  const answerCategories = content.catalog
    .filter((service) => answers.has(service.id))
    .map((service) => service.category);
  const categories = new Set(
    mode === "categories-plus"
      ? answerCategories.flatMap((id) => [id, ...adjacentCategories(content.categories, id)])
      : answerCategories,
  );
  const inMode = (service: PaletteContent["catalog"][number]) =>
    mode === "full" || categories.has(service.category);

  return {
    mode,
    services: content.catalog
      .filter((s) => used.has(s.id) || (s.status !== "deprecated" && inMode(s)))
      .map((s) => s.id),
  };
};
