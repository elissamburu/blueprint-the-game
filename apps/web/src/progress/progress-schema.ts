// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Stored format of the player progress: the PlayerProgress of game-engine inside an envelope
// with its own schemaVersion. Stored data is untrusted (it can be old, edited by hand or
// truncated), so it is migrated and then validated with Zod on every read.
import type { BestResult, PlayerProgress } from "@blueprint/game-engine";
import { EXPERIENCES, LEVELS } from "@blueprint/scenario-schema";
import * as z from "zod";

/** Current version of the stored format. Bump it and add a migration when the shape changes. */
export const PROGRESS_SCHEMA_VERSION = 1;

/** Transforms the `progress` of a stored envelope from version N to N + 1. */
export type ProgressMigration = (progress: unknown) => unknown;

/**
 * Migrations by source version: the entry N takes data stored with schemaVersion N to N + 1.
 * They run in order until PROGRESS_SCHEMA_VERSION, and the result is validated afterwards.
 */
export const PROGRESS_MIGRATIONS: Readonly<Record<number, ProgressMigration>> = {
  // Example with no changes: version 0 never shipped. A real one reads the old shape and
  // returns the new one, e.g. `(p) => ({ ...(p as object), newField: [] })`.
  0: (progress) => progress,
};

const level = z.literal(LEVELS);
const count = () => z.int().nonnegative();

const BestResultSchema = z.strictObject({
  version: z.int().positive(),
  level,
  areas: z.array(z.string().min(1)).min(1),
  score: count(),
  maxScore: count(),
  xp: z.number().nonnegative(),
  hintsUsed: count(),
  perfect: z.boolean(),
}) satisfies z.ZodType<BestResult>;

export const PlayerProgressSchema = z.strictObject({
  experience: z.enum(EXPERIENCES),
  xp: z.number().nonnegative(),
  best: z.record(z.string().min(1), BestResultSchema),
  unlocked: z.array(z.strictObject({ area: z.string().min(1), level })),
}) satisfies z.ZodType<PlayerProgress>;

export const StoredProgressSchema = z.strictObject({
  schemaVersion: z.literal(PROGRESS_SCHEMA_VERSION),
  progress: PlayerProgressSchema,
});

export type StoredProgress = z.infer<typeof StoredProgressSchema>;

const EnvelopeSchema = z.object({ schemaVersion: z.int().nonnegative(), progress: z.unknown() });

export type MigrationResult =
  | { readonly ok: true; readonly progress: PlayerProgress; readonly migratedFrom: number | null }
  | { readonly ok: false; readonly reason: string };

export interface MigrationOptions {
  readonly currentVersion: number;
  readonly migrations: Readonly<Record<number, ProgressMigration>>;
}

/** Migrates stored data to the current version and validates it. Never throws. */
export const readStoredProgress = (
  raw: unknown,
  options: MigrationOptions = {
    currentVersion: PROGRESS_SCHEMA_VERSION,
    migrations: PROGRESS_MIGRATIONS,
  },
): MigrationResult => {
  const envelope = EnvelopeSchema.safeParse(raw);
  if (!envelope.success) return { ok: false, reason: "not a progress envelope" };
  const from = envelope.data.schemaVersion;
  if (from > options.currentVersion) {
    return { ok: false, reason: `schemaVersion ${from} is newer than ${options.currentVersion}` };
  }
  let progress = envelope.data.progress;
  try {
    for (let version = from; version < options.currentVersion; version++) {
      const migrate = options.migrations[version];
      if (migrate === undefined) return { ok: false, reason: `no migration from ${version}` };
      progress = migrate(progress);
    }
  } catch (error) {
    return { ok: false, reason: `migration failed: ${String(error)}` };
  }
  const parsed = PlayerProgressSchema.safeParse(progress);
  if (!parsed.success) return { ok: false, reason: z.prettifyError(parsed.error) };
  return {
    ok: true,
    progress: parsed.data,
    migratedFrom: from === options.currentVersion ? null : from,
  };
};
