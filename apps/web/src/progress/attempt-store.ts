// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The games in progress of one backend (RF-PLAY-18). Synchronous, because the GameHost port reads
// a saved game while the screen renders: the cloud backend keeps them in memory, read once when the
// player signs in, and writes each change in the background.
import type { SavedAttempt } from "@blueprint/game-engine";

export interface AttemptStore {
  /** The saved game of the scenario; null when there is none or it was unreadable. */
  load(scenarioId: string): SavedAttempt | null;
  /** Best effort: when it cannot be kept, the game goes on without it. */
  save(attempt: SavedAttempt): void;
  clear(scenarioId: string): void;
  /** Every game in progress, with "Reiniciar progreso". */
  clearAll(): void;
  /** Resolves when the writes still on their way ended (the cloud backend writes in the background). */
  flush?(): Promise<void>;
}
