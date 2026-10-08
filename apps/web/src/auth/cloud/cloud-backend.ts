// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The progress store's backend for a signed-in player (ADR-0029), and what happens when a guest
// signs in:
//   - the profile in the cloud is empty (first sign-in of the account): the progress and the games
//     in progress of this browser are uploaded, as they are;
//   - otherwise the cloud is used and this browser's progress is left untouched (it is the guest's
//     again after signing out). No merge: the account that already played keeps its progress.
import type { SavedAttempt } from "@blueprint/game-engine";
import type { AttemptStore } from "../../progress/attempt-store";
import type { ProgressLoad, ProgressRepository } from "../../progress/progress-repository";
import type { ProgressBackend } from "../../progress/progress-store";
import type { CloudStore, ProfileInfo } from "../session";

/**
 * Games in progress of the profile: in memory (GameHost reads them while rendering), each change
 * written in the background, one after the other so they reach the table in order. A failed
 * write only warns, as a full localStorage does.
 */
export class CloudAttemptStore implements AttemptStore {
  readonly #store: CloudStore;
  readonly #warn: (message: string) => void;
  readonly #games: Map<string, SavedAttempt>;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    store: CloudStore,
    games: readonly SavedAttempt[],
    warn: (message: string) => void = (message) => console.warn(message),
  ) {
    this.#store = store;
    this.#warn = warn;
    this.#games = new Map(games.map((game) => [game.scenarioId, game]));
  }

  load(scenarioId: string): SavedAttempt | null {
    return this.#games.get(scenarioId) ?? null;
  }

  save(attempt: SavedAttempt): void {
    this.#games.set(attempt.scenarioId, attempt);
    this.#enqueue(`save ${attempt.scenarioId}`, () => this.#store.saveAttempt(attempt));
  }

  clear(scenarioId: string): void {
    this.#games.delete(scenarioId);
    this.#enqueue(`clear ${scenarioId}`, () => this.#store.deleteAttempt(scenarioId));
  }

  clearAll(): void {
    for (const scenarioId of [...this.#games.keys()]) this.clear(scenarioId);
  }

  /** Resolves when every pending write ended (tests, and before deleting the account). */
  flush(): Promise<void> {
    return this.#queue;
  }

  #enqueue(what: string, write: () => Promise<void>): void {
    this.#queue = this.#queue
      .then(write)
      .catch((error: unknown) =>
        this.#warn(`Cloud game in progress not kept (${what}): ${String(error)}`),
      );
  }
}

class CloudProgressRepository implements ProgressRepository {
  readonly #store: CloudStore;
  readonly #initial: ProgressLoad;

  constructor(store: CloudStore, initial: ProgressLoad) {
    this.#store = store;
    this.#initial = initial;
  }

  /** What was read when signing in: the store hydrates once per backend. */
  load(): Promise<ProgressLoad> {
    return Promise.resolve(this.#initial);
  }

  save(progress: Parameters<ProgressRepository["save"]>[0]): Promise<void> {
    if (this.#initial.status === "incompatible") {
      return Promise.reject(new Error("Cloud progress of a newer version: not saving"));
    }
    return this.#store.saveProgress(progress);
  }

  clear(): Promise<void> {
    if (this.#initial.status === "incompatible") return Promise.resolve();
    return this.#store.clearProgress();
  }
}

export interface LocalProgress {
  readonly progress: ProgressRepository;
  readonly attempts: () => SavedAttempt[];
}

export interface Connected {
  readonly backend: ProgressBackend;
  readonly info: ProfileInfo;
  /** The cloud was empty and this browser's progress went up to it. */
  readonly uploaded: boolean;
}

export const connectCloud = async (store: CloudStore, local: LocalProgress): Promise<Connected> => {
  let read = await store.loadProfile();
  let uploaded = false;
  if (read.status === "empty") {
    const guest = await local.progress.load();
    const games = local.attempts();
    if (guest.status === "loaded") {
      await store.saveProgress(guest.progress);
      uploaded = true;
    } else {
      // The profile exists from now on, even without progress: the next sign-in on another
      // browser uses it instead of uploading that browser's progress.
      await store.clearProgress();
    }
    for (const game of games) await store.saveAttempt(game);
    uploaded ||= games.length > 0;
    read = {
      status: "loaded",
      info: { displayName: null },
      progress: guest.status === "loaded" ? guest : { status: "empty" },
    };
  }
  const games = await store.loadAttempts();
  return {
    backend: {
      progress: new CloudProgressRepository(store, read.progress),
      attempts: new CloudAttemptStore(store, games),
    },
    info: read.info,
    uploaded,
  };
};
