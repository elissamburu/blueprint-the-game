// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Games in progress in localStorage (RF-PLAY-18), one key per scenario: the commands game-engine
// accepted, which the game screen applies again to resume. Stored data is untrusted (old, edited
// by hand, truncated), so every read is validated with Zod; what does not pass is removed with a
// warning and the scenario starts anew. There is no migration: a game in progress is cheap to
// lose, so a format change bumps ATTEMPT_SCHEMA_VERSION and older games are dropped.
import type { Command, SavedAttempt } from "@blueprint/game-engine";
import * as z from "zod";

export const ATTEMPT_STORAGE_PREFIX = "blueprint.attempt.";

/** Version of the stored format. Bump it when the shape changes: older games are dropped. */
export const ATTEMPT_SCHEMA_VERSION = 1;

const id = z.string().min(1);

const CommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("selectSlot"), slotId: id.nullable() }),
  z.strictObject({ type: z.literal("placeService"), slotId: id, serviceId: id }),
  z.strictObject({ type: z.literal("acceptAcceptable"), slotId: id }),
  z.strictObject({ type: z.literal("useHint"), slotId: id }),
  z.strictObject({ type: z.literal("clearSlot"), slotId: id }),
  z.strictObject({ type: z.literal("revealSolution"), slotId: id.nullable() }),
]) satisfies z.ZodType<Command>;

const StoredAttemptSchema = z.strictObject({
  schemaVersion: z.literal(ATTEMPT_SCHEMA_VERSION),
  attempt: z.strictObject({
    scenarioId: id,
    version: z.int().positive(),
    commands: z.array(CommandSchema),
  }),
});

export interface LocalStorageAttemptRepositoryOptions {
  /**
   * Returns the storage. A getter, because merely reading window.localStorage throws when the
   * browser blocks storage.
   */
  readonly storage?: () => Storage;
  readonly warn?: (message: string) => void;
}

export class LocalStorageAttemptRepository {
  readonly #storage: () => Storage;
  readonly #warn: (message: string) => void;

  constructor(options: LocalStorageAttemptRepositoryOptions = {}) {
    this.#storage = options.storage ?? (() => window.localStorage);
    this.#warn = options.warn ?? ((message) => console.warn(message));
  }

  /** The saved game of the scenario; null when there is none or it was unreadable (dropped). */
  load(scenarioId: string): SavedAttempt | null {
    const key = ATTEMPT_STORAGE_PREFIX + scenarioId;
    let text: string | null;
    try {
      text = this.#storage().getItem(key);
    } catch {
      return null;
    }
    if (text === null) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return this.#discard(key, "not valid JSON");
    }
    const parsed = StoredAttemptSchema.safeParse(raw);
    if (!parsed.success) return this.#discard(key, z.prettifyError(parsed.error));
    if (parsed.data.attempt.scenarioId !== scenarioId) {
      return this.#discard(key, `belongs to ${parsed.data.attempt.scenarioId}`);
    }
    return parsed.data.attempt;
  }

  /** Best effort: when the storage is blocked or full, the game goes on without being kept. */
  save(attempt: SavedAttempt): void {
    try {
      this.#storage().setItem(
        ATTEMPT_STORAGE_PREFIX + attempt.scenarioId,
        JSON.stringify({ schemaVersion: ATTEMPT_SCHEMA_VERSION, attempt }),
      );
    } catch (error) {
      this.#warn(`Game in progress not saved (${attempt.scenarioId}): ${String(error)}`);
    }
  }

  clear(scenarioId: string): void {
    try {
      this.#storage().removeItem(ATTEMPT_STORAGE_PREFIX + scenarioId);
    } catch {
      // Nothing stored if the storage is blocked.
    }
  }

  /** Every game in progress, with "Reiniciar progreso". */
  clearAll(): void {
    try {
      const storage = this.#storage();
      const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
        (key): key is string => key?.startsWith(ATTEMPT_STORAGE_PREFIX) === true,
      );
      for (const key of keys) storage.removeItem(key);
    } catch {
      // Nothing stored if the storage is blocked.
    }
  }

  #discard(key: string, reason: string): null {
    this.#warn(`Game in progress discarded (${key}): ${reason}`);
    try {
      this.#storage().removeItem(key);
    } catch {
      // Already unreadable; nothing else to do.
    }
    return null;
  }
}

export const attemptRepository = new LocalStorageAttemptRepository();
