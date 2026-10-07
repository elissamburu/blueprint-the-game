// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type * as z from "zod";
import {
  BundleCatalogSchema,
  BundleIndexSchema,
  type BundleCatalog,
  type BundleIndex,
} from "./bundle.js";
import {
  CategoriesFileSchema,
  ConfusionGroupsFileSchema,
  ServicesFileSchema,
  type Category,
  type ConfusionGroup,
  type Service,
} from "./catalog.js";
import { spanishErrorMap, toSchemaIssues, type SchemaIssue } from "./errors.js";
import {
  AreasFileSchema,
  BadgesFileSchema,
  GameRulesSchema,
  type Area,
  type Badge,
  type GameRules,
} from "./game.js";
import { ScenarioSchema, type Scenario } from "./scenario.js";

export type ParseResult<T> = { success: true; data: T } | { success: false; issues: SchemaIssue[] };

/** Validates already-deserialized data (e.g. YAML parsed by the caller) with Spanish messages. */
const parseWith =
  <S extends z.ZodType>(schema: S) =>
  (input: unknown): ParseResult<z.output<S>> => {
    const result = schema.safeParse(input, { error: spanishErrorMap });
    return result.success
      ? { success: true, data: result.data }
      : { success: false, issues: toSchemaIssues(result.error, input) };
  };

export const parseScenario: (input: unknown) => ParseResult<Scenario> = parseWith(ScenarioSchema);
export const parseServices: (input: unknown) => ParseResult<Service[]> =
  parseWith(ServicesFileSchema);
export const parseCategories: (input: unknown) => ParseResult<Category[]> =
  parseWith(CategoriesFileSchema);
export const parseConfusionGroups: (input: unknown) => ParseResult<ConfusionGroup[]> =
  parseWith(ConfusionGroupsFileSchema);
export const parseAreas: (input: unknown) => ParseResult<Area[]> = parseWith(AreasFileSchema);
export const parseGameRules: (input: unknown) => ParseResult<GameRules> =
  parseWith(GameRulesSchema);
export const parseBadges: (input: unknown) => ParseResult<Badge[]> = parseWith(BadgesFileSchema);
export const parseBundleIndex: (input: unknown) => ParseResult<BundleIndex> =
  parseWith(BundleIndexSchema);
export const parseBundleCatalog: (input: unknown) => ParseResult<BundleCatalog> =
  parseWith(BundleCatalogSchema);

/**
 * A deserialized scenario with `status: draft` that does not pass the schema. The Studio saves
 * drafts with errors (ADR-0025, amendment S10), possibly untracked in a local checkout: the
 * development tools skip them instead of failing. Any other scenario that does not parse is still
 * an error.
 */
export const isUnparsableDraftDocument = (document: unknown): boolean =>
  typeof document === "object" &&
  document !== null &&
  (document as Record<string, unknown>).status === "draft" &&
  !parseScenario(document).success;

/**
 * {@link isUnparsableDraftDocument} over the text of a scenario.yaml. The YAML parser is the
 * caller's (this package does no IO and has no runtime YAML dependency); a text that is not valid
 * YAML is not a draft to skip, it fails as before.
 */
export const isUnparsableDraft = (raw: string, parseYaml: (text: string) => unknown): boolean => {
  let document: unknown;
  try {
    document = parseYaml(raw);
  } catch {
    return false;
  }
  return isUnparsableDraftDocument(document);
};
