// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Guest progress in localStorage (ADR-0010). Reads migrate and validate the stored data; if it
// is corrupt it is copied to a backup key and removed with a warning instead of breaking the
// app. Data written by a newer version of the game is never touched: see `incompatible`.
import type { PlayerProgress } from "@blueprint/game-engine";
import type { ProgressLoad, ProgressRepository } from "./progress-repository";
import {
  PROGRESS_MIGRATIONS,
  PROGRESS_SCHEMA_VERSION,
  readStoredProgress,
  type MigrationOptions,
} from "./progress-schema";

export const PROGRESS_STORAGE_KEY = "blueprint.progress";

/** Suffix of the key that keeps the last discarded text, so it can be recovered by hand. */
export const PROGRESS_BACKUP_SUFFIX = ".backup";

/** save() after an `incompatible` load. */
export class IncompatibleProgressError extends Error {
  constructor(readonly storedVersion: number) {
    super(`Stored progress has schemaVersion ${storedVersion}, newer than this app; not saving`);
    this.name = "IncompatibleProgressError";
  }
}

export interface LocalStorageProgressRepositoryOptions extends Partial<MigrationOptions> {
  /**
   * Returns the storage. A getter, because merely reading window.localStorage throws when the
   * browser blocks storage.
   */
  readonly storage?: () => Storage;
  readonly key?: string;
  readonly warn?: (message: string) => void;
}

export class LocalStorageProgressRepository implements ProgressRepository {
  readonly #storage: () => Storage;
  readonly #key: string;
  readonly #migration: MigrationOptions;
  readonly #warn: (message: string) => void;
  /** Set when the stored data is newer than this app: writes are blocked until a reload. */
  #newerVersion: number | null = null;

  constructor(options: LocalStorageProgressRepositoryOptions = {}) {
    this.#storage = options.storage ?? (() => window.localStorage);
    this.#key = options.key ?? PROGRESS_STORAGE_KEY;
    this.#migration = {
      currentVersion: options.currentVersion ?? PROGRESS_SCHEMA_VERSION,
      migrations: options.migrations ?? PROGRESS_MIGRATIONS,
    };
    this.#warn = options.warn ?? ((message) => console.warn(message));
  }

  load(): Promise<ProgressLoad> {
    this.#newerVersion = null;
    let text: string | null;
    try {
      text = this.#storage().getItem(this.#key);
    } catch {
      // Storage blocked: behave as a first visit; save() will report the failure.
      return Promise.resolve({ status: "empty" });
    }
    if (text === null) return Promise.resolve({ status: "empty" });

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return Promise.resolve(this.#discard(text, "not valid JSON"));
    }
    const result = readStoredProgress(raw, this.#migration);
    if (!result.ok && result.kind === "newer") {
      this.#newerVersion = result.storedVersion;
      this.#warn(
        `Stored progress kept (${this.#key}): schemaVersion ${result.storedVersion} is newer than ${this.#migration.currentVersion}`,
      );
      return Promise.resolve({ status: "incompatible", storedVersion: result.storedVersion });
    }
    if (!result.ok) return Promise.resolve(this.#discard(text, result.reason));
    if (result.migratedFrom !== null) this.#write(result.progress);
    return Promise.resolve({ status: "loaded", progress: result.progress });
  }

  save(progress: PlayerProgress): Promise<void> {
    if (this.#newerVersion !== null) {
      return Promise.reject(new IncompatibleProgressError(this.#newerVersion));
    }
    try {
      this.#write(progress);
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  clear(): Promise<void> {
    if (this.#newerVersion !== null) return Promise.resolve();
    try {
      this.#storage().removeItem(this.#key);
    } catch {
      // Nothing stored if the storage is blocked.
    }
    return Promise.resolve();
  }

  #write(progress: PlayerProgress): void {
    const stored = { schemaVersion: this.#migration.currentVersion, progress };
    this.#storage().setItem(this.#key, JSON.stringify(stored));
  }

  #discard(text: string, reason: string): ProgressLoad {
    this.#warn(`Stored progress discarded (${this.#key}): ${reason}`);
    try {
      // A single copy: the last discarded text replaces the previous one.
      this.#storage().setItem(this.#key + PROGRESS_BACKUP_SUFFIX, text);
    } catch {
      // No room for the backup (quota): still remove the data so the app can start.
    }
    try {
      this.#storage().removeItem(this.#key);
    } catch {
      // Already unreadable; nothing else to do.
    }
    return { status: "discarded", reason };
  }
}
