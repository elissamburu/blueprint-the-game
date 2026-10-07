// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Palette resolution shared by content-lint (L016, L022) and game-engine (docs/03 §2, RF-128).
import type { Category, ConfusionGroup, Service } from "./catalog.js";
import type { CONCRETE_PALETTE_MODES, LEVELS } from "./common.js";
import type { GameRules } from "./game.js";
import type { Scenario } from "./scenario.js";

export type ConcretePaletteMode = (typeof CONCRETE_PALETTE_MODES)[number];

/** Explicit `palette.mode`, or `auto` (also when there is no palette) resolved by level. */
export const resolvePaletteMode = (
  scenario: Pick<Scenario, "level" | "palette">,
  gameRules: Pick<GameRules, "palette">,
): ConcretePaletteMode => {
  const mode = scenario.palette?.mode ?? "auto";
  if (mode !== "auto") return mode;
  const level = String(scenario.level) as `${(typeof LEVELS)[number]}`;
  return gameRules.palette.modeByLevel[level];
};

/**
 * Size limit of a curated palette: the scenario's `palette.maxSize`, else
 * `gameRules.palette.maxSizeByLevel[level]`, else `gameRules.palette.defaultMaxSize`.
 */
export const curatedMaxSize = (
  scenario: Pick<Scenario, "level" | "palette">,
  gameRules: Pick<GameRules, "palette">,
): number => {
  const palette = scenario.palette;
  if (palette !== undefined && "maxSize" in palette && palette.maxSize !== undefined) {
    return palette.maxSize;
  }
  const level = String(scenario.level) as `${(typeof LEVELS)[number]}`;
  return gameRules.palette.maxSizeByLevel?.[level] ?? gameRules.palette.defaultMaxSize;
};

export interface CuratedPalette {
  /** Size limit from `curatedMaxSize`. */
  maxSize: number;
  /** Final palette: every answer first, then the distractors that fit. */
  services: string[];
  /** Optimal and acceptable answers of every slot. Never trimmed, even beyond `maxSize`. */
  answers: string[];
  /** Distractors that made it into the palette, in build order. */
  distractors: string[];
  /** Distractors left out because the palette reached `maxSize`. */
  dropped: string[];
}

/**
 * Builds the curated palette deterministically (docs/03 §2 "Paleta curated"):
 * 1. answers (optimal and acceptable) of every slot, never trimmed;
 * 2. `incorrect` services of the slots;
 * 3. `palette.extra`;
 * 4. confusion-group mates of the answers, except `deprecated` ones (RF-PAL-05: a deprecated
 *    service appears only if the author chose it as answer, `incorrect` or `palette.extra`).
 * Each step keeps order of appearance (nodes, then entries; confusion groups in file order)
 * and skips services already added, services of fixed nodes (as distractors) and services
 * missing from the catalog (lint L002 reports those). Distractors are cut at `maxSize`.
 */
export const buildCuratedPalette = (
  scenario: Pick<Scenario, "level" | "diagram" | "palette">,
  catalog: readonly Pick<Service, "id" | "status">[],
  confusionGroups: readonly Pick<ConfusionGroup, "services">[],
  gameRules: Pick<GameRules, "palette">,
): CuratedPalette => {
  const known = new Set(catalog.map((service) => service.id));
  const deprecated = new Set(
    catalog.filter((service) => service.status === "deprecated").map((service) => service.id),
  );
  const palette = scenario.palette;
  const maxSize = curatedMaxSize(scenario, gameRules);

  const nodes = scenario.diagram.nodes;
  const answers = unique(
    nodes.flatMap((node) => (node.type === "slot" ? node.answers.map((a) => a.service) : [])),
  ).filter((id) => known.has(id));

  const excluded = new Set([
    ...answers,
    ...nodes.flatMap((node) => (node.type === "fixed" ? [node.service] : [])),
  ]);
  const candidates = [
    ...nodes.flatMap((node) => (node.type === "slot" ? node.incorrect.map((i) => i.service) : [])),
    ...(palette?.extra ?? []),
    ...answers.flatMap((answer) =>
      confusionGroups
        .filter((group) => group.services.includes(answer))
        .flatMap((group) => group.services)
        .filter((id) => !deprecated.has(id)),
    ),
  ];
  const allDistractors = unique(candidates).filter((id) => known.has(id) && !excluded.has(id));

  const room = Math.max(0, maxSize - answers.length);
  const distractors = allDistractors.slice(0, room);
  return {
    maxSize,
    services: [...answers, ...distractors],
    answers,
    distractors,
    dropped: allDistractors.slice(room),
  };
};

export interface PaletteContent {
  readonly catalog: readonly Pick<Service, "id" | "type" | "category" | "status">[];
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
 * Palette of a scenario by resolved mode (RF-PAL-01, RF-PAL-05, docs/01 "Modos de paleta"),
 * used by game-engine to play and by content-lint (L022):
 * - `curated`: `buildCuratedPalette`.
 * - `categories`: every service of the categories of the answers.
 * - `categories-plus`: `categories` plus the adjacent categories.
 * - `full`: the whole catalog.
 * The last three also include the services the scenario uses (answers, `incorrect`,
 * `palette.extra`); `deprecated` services (RF-PAL-05) and concepts (RF-PAL-07) appear only if
 * the scenario uses them: concepts never fill these modes.
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
      .filter(
        (s) => used.has(s.id) || (s.status !== "deprecated" && s.type !== "concept" && inMode(s)),
      )
      .map((s) => s.id),
  };
};

/**
 * Categories adjacent to `categoryId` for the `categories-plus` palette mode (docs/03 §6).
 * Adjacency is symmetric by definition: A is adjacent to B if A lists B **or** B lists A,
 * so `categories.yaml` may declare each pair on either side. Result in file order, without
 * the category itself and without categories missing from the file (lint C002 reports those).
 */
export const adjacentCategories = (
  categories: readonly Pick<Category, "id" | "adjacent">[],
  categoryId: string,
): string[] => {
  const declared = new Set(categories.find((category) => category.id === categoryId)?.adjacent);
  return unique(
    categories
      .filter(
        (category) =>
          category.id !== categoryId &&
          (declared.has(category.id) || category.adjacent.includes(categoryId)),
      )
      .map((category) => category.id),
  );
};

const unique = (ids: readonly string[]): string[] => [...new Set(ids)];
