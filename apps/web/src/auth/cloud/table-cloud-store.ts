// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The player's profile on a table keyed by pk (the identity ID of the player) and sk (ADR-0029):
//   sk = "profile"             displayName, avatar, xp, completed scenarios, the progress, dates
//   sk = "attempt#<scenarioId>" a game in progress (what saveAttempt keeps, RF-PLAY-18)
// Every item read is untrusted (another version of the game, a player with their own
// credentials) and validated with Zod: an unreadable progress is discarded like the local one, an
// unreadable game in progress is skipped. xp and completed are a copy of the progress for whoever
// reads the table; the game only trusts the progress (and the player can write all of it: the
// trade-off of ADR-0029). Writes replace the whole profile item: one tab, last write wins.
import type { PlayerProgress, SavedAttempt } from "@blueprint/game-engine";
import * as z from "zod";
import {
  ATTEMPT_SCHEMA_VERSION,
  SavedAttemptSchema,
} from "../../progress/local-storage-attempt-repository";
import type { ProgressLoad } from "../../progress/progress-repository";
import { PROGRESS_SCHEMA_VERSION, readStoredProgress } from "../../progress/progress-schema";
import { DISPLAY_NAME_MAX } from "../limits";
import type { CloudStore, ProfileRead } from "../session";

/** The items of one player. Implementations bind pk; the store never builds another one. */
export interface ProfileTable {
  readonly pk: string;
  get(sk: string): Promise<unknown>;
  put(item: Readonly<Record<string, unknown>>): Promise<void>;
  delete(sk: string): Promise<void>;
  /** Every item whose sk starts with the prefix ("" for all of them). */
  query(skPrefix: string): Promise<unknown[]>;
}

export const PROFILE_SK = "profile";
export const ATTEMPT_SK_PREFIX = "attempt#";
/** Version of the profile item. Bump it when the shape changes. */
export const PROFILE_ITEM_VERSION = 1;

export const DisplayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX);

const ProfileItemSchema = z.object({
  pk: z.string().min(1),
  sk: z.literal(PROFILE_SK),
  schemaVersion: z.literal(PROFILE_ITEM_VERSION),
  displayName: DisplayNameSchema.optional(),
  avatar: z
    .string()
    .regex(/^[a-z0-9-]{1,32}$/)
    .optional(),
  xp: z.number().nonnegative(),
  completed: z.array(z.string().min(1)),
  /** The envelope of the local progress ({ schemaVersion, progress }), read with its migrations. */
  progress: z.unknown().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

const AttemptItemSchema = z.object({
  pk: z.string().min(1),
  sk: z.string().startsWith(ATTEMPT_SK_PREFIX),
  schemaVersion: z.literal(ATTEMPT_SCHEMA_VERSION),
  attempt: SavedAttemptSchema,
  updatedAt: z.iso.datetime(),
});

interface Profile {
  displayName: string | undefined;
  avatar: string | undefined;
  createdAt: string;
  progress: PlayerProgress | null;
}

export class TableCloudStore implements CloudStore {
  readonly #table: ProfileTable;
  readonly #now: () => string;
  readonly #warn: (message: string) => void;
  /** The profile as last read or written. */
  #profile: Profile | null = null;

  constructor(
    table: ProfileTable,
    options: { now?: () => string; warn?: (message: string) => void } = {},
  ) {
    this.#table = table;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#warn = options.warn ?? ((message) => console.warn(message));
  }

  async loadProfile(): Promise<ProfileRead> {
    const raw = await this.#table.get(PROFILE_SK);
    if (raw === undefined) {
      this.#profile = null;
      return { status: "empty" };
    }
    const item = ProfileItemSchema.safeParse(raw);
    if (!item.success || item.data.pk !== this.#table.pk) {
      // Unreadable: the player starts over, and the next save replaces it.
      const reason = item.success ? "belongs to another player" : z.prettifyError(item.error);
      this.#warn(`Cloud profile discarded: ${reason}`);
      this.#profile = this.#fresh();
      return {
        status: "loaded",
        info: { displayName: null },
        progress: { status: "discarded", reason },
      };
    }
    const progress = this.#readProgress(item.data.progress);
    this.#profile = {
      displayName: item.data.displayName,
      avatar: item.data.avatar,
      createdAt: item.data.createdAt,
      progress: progress.status === "loaded" ? progress.progress : null,
    };
    return { status: "loaded", info: { displayName: item.data.displayName ?? null }, progress };
  }

  saveProgress(progress: PlayerProgress): Promise<void> {
    return this.#write({ progress });
  }

  clearProgress(): Promise<void> {
    return this.#write({ progress: null });
  }

  async saveDisplayName(displayName: string): Promise<void> {
    await this.#write({ displayName: DisplayNameSchema.parse(displayName) });
  }

  async loadAttempts(): Promise<SavedAttempt[]> {
    const items = await this.#table.query(ATTEMPT_SK_PREFIX);
    return items.flatMap((raw) => {
      const item = AttemptItemSchema.safeParse(raw);
      if (
        !item.success ||
        item.data.pk !== this.#table.pk ||
        item.data.sk !== ATTEMPT_SK_PREFIX + item.data.attempt.scenarioId
      ) {
        this.#warn(
          `Cloud game in progress skipped: ${item.success ? "key mismatch" : z.prettifyError(item.error)}`,
        );
        return [];
      }
      return [item.data.attempt];
    });
  }

  saveAttempt(attempt: SavedAttempt): Promise<void> {
    return this.#table.put({
      pk: this.#table.pk,
      sk: ATTEMPT_SK_PREFIX + attempt.scenarioId,
      schemaVersion: ATTEMPT_SCHEMA_VERSION,
      attempt,
      updatedAt: this.#now(),
    });
  }

  deleteAttempt(scenarioId: string): Promise<void> {
    return this.#table.delete(ATTEMPT_SK_PREFIX + scenarioId);
  }

  async deleteAll(): Promise<void> {
    const items = await this.#table.query("");
    for (const raw of items) {
      const sk = z.object({ sk: z.string().min(1) }).safeParse(raw);
      if (sk.success) await this.#table.delete(sk.data.sk);
    }
    this.#profile = null;
  }

  #readProgress(stored: unknown): ProgressLoad {
    if (stored === undefined) return { status: "empty" };
    const result = readStoredProgress(stored);
    if (result.ok) return { status: "loaded", progress: result.progress };
    if (result.kind === "newer")
      return { status: "incompatible", storedVersion: result.storedVersion };
    this.#warn(`Cloud progress discarded: ${result.reason}`);
    return { status: "discarded", reason: result.reason };
  }

  #fresh(): Profile {
    return { displayName: undefined, avatar: undefined, createdAt: this.#now(), progress: null };
  }

  async #write(change: { progress?: PlayerProgress | null; displayName?: string }): Promise<void> {
    const profile: Profile = { ...(this.#profile ?? this.#fresh()), ...change };
    const progress = profile.progress;
    await this.#table.put({
      pk: this.#table.pk,
      sk: PROFILE_SK,
      schemaVersion: PROFILE_ITEM_VERSION,
      ...(profile.displayName === undefined ? {} : { displayName: profile.displayName }),
      ...(profile.avatar === undefined ? {} : { avatar: profile.avatar }),
      xp: progress?.xp ?? 0,
      completed: Object.keys(progress?.best ?? {}),
      ...(progress === null
        ? {}
        : { progress: { schemaVersion: PROGRESS_SCHEMA_VERSION, progress } }),
      createdAt: profile.createdAt,
      updatedAt: this.#now(),
    });
    this.#profile = profile;
  }
}
