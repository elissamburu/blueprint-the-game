// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Player progress in memory, persisted through a ProgressRepository. The store only holds and
// saves what game-engine computes: XP, ranks and unlocks are never calculated here.
import type { PlayerProgress } from "@blueprint/game-engine";
import { create } from "zustand";
import { LocalStorageProgressRepository } from "./local-storage-progress-repository";
import type { ProgressRepository } from "./progress-repository";

/** Something the player should be told once (as a toast). */
export type ProgressNotice = "discarded" | "save-failed";

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
  hydrate: () => Promise<void>;
  /** Replaces the progress with one computed by game-engine and saves it. */
  replace: (progress: PlayerProgress) => Promise<void>;
  reset: () => Promise<void>;
  dismissNotice: () => void;
}

export const createProgressStore = (repository: ProgressRepository) =>
  create<ProgressState>()((set, get) => ({
    status: "idle",
    progress: null,
    notice: null,
    incompatible: false,
    hydrate: async () => {
      if (get().status !== "idle") return;
      set({ status: "loading" });
      const result = await repository.load();
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
    },
    dismissNotice: () => set({ notice: null }),
  }));

export const useProgressStore = createProgressStore(new LocalStorageProgressRepository());
