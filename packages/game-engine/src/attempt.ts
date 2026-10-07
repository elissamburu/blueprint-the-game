// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game in progress (RF-PLAY-18): what is kept is the list of commands the engine accepted, not
// the derived state. Resuming applies them again with the same reducer, so every grade, error,
// hint and viewed solution comes back as it was: reloading never improves the score, and a rule
// that changes in the engine applies to the resumed game too.
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import {
  applyCommand,
  createSession,
  type Command,
  type CommandOutcome,
  type SessionState,
} from "./session.js";

export interface SavedAttempt {
  readonly scenarioId: string;
  /** `version` of the scenario the commands were played on. */
  readonly version: number;
  /** Accepted commands, in order. */
  readonly commands: readonly Command[];
}

/**
 * - `new`: nothing saved (or nothing played yet).
 * - `resumed`: the saved commands rebuilt the session.
 * - `outdated`: the scenario changed its `version`; the saved game is dropped and the player is
 *   told.
 * - `invalid`: the saved game is not of this scenario or a command no longer applies; dropped.
 */
export type AttemptResumeKind = "new" | "resumed" | "outdated" | "invalid";

export interface AttemptResume {
  readonly kind: AttemptResumeKind;
  readonly session: SessionState;
  /** The commands of `session`: the saved ones when resumed, none otherwise. */
  readonly commands: readonly Command[];
}

/**
 * Appends a command to the attempt when the engine accepted it. Rejected commands change nothing,
 * and a selection is not progress: neither is kept. Returns the same array when nothing is added.
 */
export const recordCommand = (
  recorded: readonly Command[],
  command: Command,
  outcome: CommandOutcome,
): readonly Command[] =>
  outcome.type === "rejected" || command.type === "selectSlot" ? recorded : [...recorded, command];

export const attemptOf = (
  scenario: Pick<Scenario, "id" | "version">,
  commands: readonly Command[],
): SavedAttempt => ({ scenarioId: scenario.id, version: scenario.version, commands });

/** Rebuilds the session of a saved attempt by applying its commands again. */
export const resumeAttempt = (
  scenario: Scenario,
  rules: GameRules,
  saved: SavedAttempt | null,
): AttemptResume => {
  const fresh = createSession(scenario, rules);
  const start = (kind: AttemptResumeKind): AttemptResume => ({
    kind,
    session: fresh,
    commands: [],
  });
  if (saved === null) return start("new");
  if (saved.scenarioId !== scenario.id) return start("invalid");
  if (saved.version !== scenario.version) return start("outdated");
  if (saved.commands.length === 0) return start("new");
  let session = fresh;
  for (const command of saved.commands) {
    const { state, outcome } = applyCommand(session, command);
    // Every saved command was accepted when it was played: one that is rejected now means the
    // data does not belong to this scenario.
    if (outcome.type === "rejected" || command.type === "selectSlot") return start("invalid");
    session = state;
  }
  return {
    kind: "resumed",
    session: { ...session, selectedSlotId: null },
    commands: saved.commands,
  };
};
