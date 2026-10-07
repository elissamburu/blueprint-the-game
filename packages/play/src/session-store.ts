// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Current game session. A thin wrapper over the game-engine reducer (ADR-0008): drag, tap and
// keyboard adapters dispatch the same commands, and every rule stays in the engine. It also keeps
// the accepted commands, which are what the host saves of a game in progress (RF-PLAY-18).
import {
  applyCommand,
  createSession,
  recordCommand,
  type Command,
  type CommandOutcome,
  type SessionState,
} from "@blueprint/game-engine";
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import { create } from "zustand";

export interface SessionStoreState {
  readonly session: SessionState | null;
  /** Commands that built `session` (see `recordCommand`); a new array after each new one. */
  readonly commands: readonly Command[];
  /** Outcome of the last command, for the feedback panel and announcements. */
  readonly lastOutcome: CommandOutcome | null;
  start: (scenario: Scenario, rules: GameRules) => void;
  /** Starts from a session rebuilt by game-engine (`resumeAttempt`) and its commands. */
  resume: (session: SessionState, commands: readonly Command[]) => void;
  /** "Empezar de nuevo": the same scenario, with nothing played. */
  restart: () => void;
  /** Applies a command to the session; null when there is no session. */
  dispatch: (command: Command) => CommandOutcome | null;
  end: () => void;
}

export const createSessionStore = () =>
  create<SessionStoreState>()((set, get) => ({
    session: null,
    commands: [],
    lastOutcome: null,
    start: (scenario, rules) =>
      set({ session: createSession(scenario, rules), commands: [], lastOutcome: null }),
    resume: (session, commands) => set({ session, commands, lastOutcome: null }),
    restart: () => {
      const { session } = get();
      if (session !== null) get().start(session.scenario, session.rules);
    },
    dispatch: (command) => {
      const { session, commands } = get();
      if (session === null) return null;
      const { state, outcome } = applyCommand(session, command);
      set({
        session: state,
        commands: recordCommand(commands, command, outcome),
        lastOutcome: outcome,
      });
      return outcome;
    },
    end: () => set({ session: null, commands: [], lastOutcome: null }),
  }));

export const useSessionStore = createSessionStore();
