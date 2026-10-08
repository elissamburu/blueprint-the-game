// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Player progress in memory, persisted through a ProgressRepository. The store only holds and
// saves what game-engine computes: XP, ranks and unlocks are never calculated here. "Reiniciar
// progreso" also forgets the games in progress (RF-PLAY-18).
//
// Where it is persisted can change while the app runs (ADR-0029): this browser for guests, the
// player's profile in the cloud after signing in. `switchTo` replaces both repositories and
// reads the progress again; a read of the previous backend that ends later is ignored.
import type { PlayerProgress } from "@blueprint/game-engine";
import { create } from "zustand";
import type { AttemptStore } from "./attempt-store";
import { attemptRepository } from "./local-storage-attempt-repository";
import { LocalStorageProgressRepository } from "./local-storage-progress-repository";
import type { ProgressRepository } from "./progress-repository";

/** Something the player should be told once (as a toast). */
export type ProgressNotice = "discarded" | "save-failed";

/** Where the progress and the games in progress are kept. */
export interface ProgressBackend {
  readonly progress: ProgressRepository;
  readonly attempts: AttemptStore;
}

export interface ProgressState {
  /** `ready` once the stored progress was read; routes that depend on it wait for it. */
  readonly status: "idle" | "loading" | "ready";
  /** null until onboarding creates it. */
  readonly progress: PlayerProgress | null;
  readonly notice: ProgressNotice | null;
  /**
   * The stored progress comes from a newer version of the game. It is not loaded nor
   * overwritten; the player is asked to reload while this lasts.
   */
  readonly incompatible: boolean;
  /** The games in progress of the current backend (the web GameHost reads and writes them). */
  readonly attempts: AttemptStore;
  hydrate: () => Promise<void>;
  /** Replaces the progress with one computed by game-engine and saves it. */
  replace: (progress: PlayerProgress) => Promise<void>;
  /** Removes the progress and every game in progress. */
  reset: () => Promise<void>;
  /** Moves to another backend (signing in or out) and reads the progress from it. */
  switchTo: (backend: ProgressBackend) => Promise<void>;
  dismissNotice: () => void;
}

/** Without a place for games in progress (tests): nothing is kept. */
const NO_ATTEMPTS: AttemptStore = {
  load: () => null,
  save: () => undefined,
  clear: () => undefined,
  clearAll: () => undefined,
};

export const createProgressStore = (
  initialRepository: ProgressRepository,
  initialAttempts: AttemptStore = NO_ATTEMPTS,
) =>
  create<ProgressState>()((set, get) => {
    let repository = initialRepository;
    /** Bumped by switchTo: a load that started before belongs to the previous backend. */
    let generation = 0;
    return {
      status: "idle",
      progress: null,
      notice: null,
      incompatible: false,
      attempts: initialAttempts,
      hydrate: async () => {
        if (get().status !== "idle") return;
        set({ status: "loading" });
        const current = generation;
        const result = await repository.load();
        if (current !== generation) return;
        set({
          status: "ready",
          progress: result.status === "loaded" ? result.progress : null,
          notice: result.status === "discarded" ? "discarded" : get().notice,
          incompatible: result.status === "incompatible",
        });
      },
      replace: async (progress) => {
        set({ progress });
        // The repository refuses too; not trying avoids a "save failed" on top of the banner.
        if (get().incompatible) return;
        try {
          await repository.save(progress);
        } catch {
          // The game goes on in memory; the player is told the progress is not being kept.
          set({ notice: "save-failed" });
        }
      },
      reset: async () => {
        set({ progress: null });
        if (get().incompatible) return;
        await repository.clear();
        get().attempts.clearAll();
      },
      switchTo: async (backend) => {
        generation += 1;
        repository = backend.progress;
        set({
          status: "idle",
          progress: null,
          incompatible: false,
          attempts: backend.attempts,
        });
        await get().hydrate();
      },
      dismissNotice: () => set({ notice: null }),
    };
  });

/** This browser: the guest mode, and the backend again after signing out. */
export const localBackend = (): ProgressBackend => ({
  progress: new LocalStorageProgressRepository(),
  attempts: attemptRepository,
});

export const useProgressStore = createProgressStore(
  new LocalStorageProgressRepository(),
  attemptRepository,
);
