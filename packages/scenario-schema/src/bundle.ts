// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Schemas of the JSON bundle written by content:build (docs/03 §1, ADR-0006) and read by the
// game at runtime. Scenario files (<id>.v<version>.json) use ScenarioSchema; game-rules.json
// uses GameRulesSchema.
import * as z from "zod";
import { CategoriesFileSchema, ConfusionGroupsFileSchema, ServicesFileSchema } from "./catalog.js";
import { AreasFileSchema } from "./game.js";
import { ScenarioSchema, type Scenario } from "./scenario.js";

/** Format version of index.json. Bump it when the bundle changes shape. */
export const BUNDLE_SCHEMA_VERSION = 1;

/**
 * Statuses shown in the game's listing (index.json). Retired scenarios are never listed; drafts
 * only in local development. content:build writes the index with it and the game filters it
 * again when loading the bundle.
 */
export const listedStatuses = (includeDrafts: boolean): ReadonlySet<Scenario["status"]> =>
  new Set<Scenario["status"]>(
    includeDrafts ? ["draft", "beta", "published"] : ["beta", "published"],
  );

/** Listing data of a scenario: what the cards need without loading the whole scenario. */
export const BundleIndexEntrySchema = ScenarioSchema.pick({
  id: true,
  version: true,
  status: true,
  level: true,
  areas: true,
  title: true,
  summary: true,
  estimatedMinutes: true,
}).extend({
  file: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*\.v\d+\.json$/, {
      error: "file tiene que ser <id>.v<version>.json",
    })
    .describe("Archivo del escenario dentro del bundle."),
});

export const BundleIndexSchema = z.strictObject({
  schemaVersion: z.literal(BUNDLE_SCHEMA_VERSION, {
    error: `schemaVersion tiene que ser ${BUNDLE_SCHEMA_VERSION}`,
  }),
  areas: AreasFileSchema,
  scenarios: z.array(BundleIndexEntrySchema),
});

export const BundleCatalogSchema = z.strictObject({
  services: ServicesFileSchema,
  categories: CategoriesFileSchema,
  confusionGroups: ConfusionGroupsFileSchema,
});

export type BundleIndexEntry = z.infer<typeof BundleIndexEntrySchema>;
export type BundleIndex = z.infer<typeof BundleIndexSchema>;
export type BundleCatalog = z.infer<typeof BundleCatalogSchema>;
