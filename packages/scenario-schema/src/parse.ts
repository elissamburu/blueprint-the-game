// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type * as z from "zod";
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
