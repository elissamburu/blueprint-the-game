// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Current game session. A thin wrapper over the game-engine reducer (ADR-0008): drag, tap and
// keyboard adapters dispatch the same commands, and every rule stays in the engine.
import {
  applyCommand,
  createSession,
  type Command,
  type CommandOutcome,
  type SessionState,
} from "@blueprint/game-engine";
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import { create } from "zustand";

export interface SessionStoreState {
  readonly session: SessionState | null;
  /** Outcome of the last command, for the feedback panel and announcements. */
  readonly lastOutcome: CommandOutcome | null;
  start: (scenario: Scenario, rules: GameRules) => void;
  /** Applies a command to the session; null when there is no session. */
  dispatch: (command: Command) => CommandOutcome | null;
  end: () => void;
}

export const createSessionStore = () =>
  create<SessionStoreState>()((set, get) => ({
    session: null,
    lastOutcome: null,
    start: (scenario, rules) => set({ session: createSession(scenario, rules), lastOutcome: null }),
    dispatch: (command) => {
      const { session } = get();
      if (session === null) return null;
      const { state, outcome } = applyCommand(session, command);
      set({ session: state, lastOutcome: outcome });
      return outcome;
    },
    end: () => set({ session: null, lastOutcome: null }),
  }));

export const useSessionStore = createSessionStore();
