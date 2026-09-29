// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where the player progress lives (ADR-0010). Guest mode uses LocalStorageProgressRepository;
// F4 adds an ApiProgressRepository behind this same interface, which is why it is async.
import type { PlayerProgress } from "@blueprint/game-engine";

export type ProgressLoad =
  | { readonly status: "empty" }
  | { readonly status: "loaded"; readonly progress: PlayerProgress }
  /** The stored data was unreadable and was dropped; the player starts over. */
  | { readonly status: "discarded"; readonly reason: string }
  /**
   * The stored data comes from a newer version of the game. It is left untouched and the
   * repository refuses to write until the page is reloaded with that version.
   */
  | { readonly status: "incompatible"; readonly storedVersion: number };

export interface ProgressRepository {
  load(): Promise<ProgressLoad>;
  /** Rejects when the progress could not be stored, or after an `incompatible` load. */
  save(progress: PlayerProgress): Promise<void>;
  /** Does nothing after an `incompatible` load. */
  clear(): Promise<void>;
}
