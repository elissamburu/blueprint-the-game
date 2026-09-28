// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game session as a pure reducer over the commands of ADR-0008. Drag, tap and keyboard
// adapters emit the same commands; the UI renders the state and never decides grades.
import type { GameRules, Scenario, SlotNode } from "@blueprint/scenario-schema";
import { evaluatePlacement, type Evaluation } from "./evaluate.js";

export interface SlotState {
  readonly slotId: string;
  /** Service currently placed, or null when the slot is empty. */
  readonly placed: string | null;
  /** Evaluation of `placed` (null when empty). */
  readonly evaluation: Evaluation | null;
  /** The player kept the current orange ("me quedo con esta", RF-PLAY-08). */
  readonly accepted: boolean;
  /** Red placements so far: the N of "verde tras N errores". Oranges never count. */
  readonly errors: number;
  /** Placements of any grade, to tell a green at the first attempt. */
  readonly placements: number;
  /** Hints revealed so far, in order (RF-PLAY-06). */
  readonly hintsRevealed: number;
}

/**
 * - `empty`: nothing placed.
 * - `incorrect` / `acceptable`: red or orange placed; the player can retry (RF-PLAY-07).
 * - `accepted`: orange kept by the player; resolved until `clearSlot`.
 * - `optimal`: green; revealed and locked (RF-EVAL-04).
 */
export type SlotStatus = "empty" | "incorrect" | "acceptable" | "accepted" | "optimal";

export interface SessionState {
  readonly scenario: Scenario;
  readonly rules: GameRules;
  readonly selectedSlotId: string | null;
  /** One entry per slot, in diagram order. */
  readonly slots: readonly SlotState[];
  /** Every slot is green or an accepted orange (RF-PLAY-08). Commands are rejected afterwards. */
  readonly completed: boolean;
}

export type Command =
  | { type: "selectSlot"; slotId: string | null }
  | { type: "placeService"; slotId: string; serviceId: string }
  | { type: "acceptAcceptable"; slotId: string }
  | { type: "useHint"; slotId: string }
  | { type: "clearSlot"; slotId: string };

/** Command creators with the names of ADR-0008. */
export const commands = {
  selectSlot: (slotId: string | null): Command => ({ type: "selectSlot", slotId }),
  placeService: (slotId: string, serviceId: string): Command => ({
    type: "placeService",
    slotId,
    serviceId,
  }),
  acceptAcceptable: (slotId: string): Command => ({ type: "acceptAcceptable", slotId }),
  useHint: (slotId: string): Command => ({ type: "useHint", slotId }),
  clearSlot: (slotId: string): Command => ({ type: "clearSlot", slotId }),
} as const;

export type RejectionReason =
  | "session-completed"
  | "unknown-slot"
  /** The slot is green. */
  | "slot-locked"
  /** The slot holds an accepted orange: `clearSlot` first to try another service. */
  | "slot-accepted"
  /** The same service is already placed in the slot: no new attempt, no penalty. */
  | "already-placed"
  | "not-acceptable"
  | "no-hints-left"
  | "slot-empty";

export type CommandOutcome =
  | { type: "slotSelected"; slotId: string | null }
  | { type: "servicePlaced"; slotId: string; evaluation: Evaluation }
  | { type: "acceptableAccepted"; slotId: string }
  | { type: "hintRevealed"; slotId: string; hint: string; index: number }
  | { type: "slotCleared"; slotId: string }
  | { type: "rejected"; command: Command; reason: RejectionReason };

export interface CommandResult {
  /** New state; the same object when the command is rejected. */
  readonly state: SessionState;
  readonly outcome: CommandOutcome;
}

export const slotNodes = (scenario: Pick<Scenario, "diagram">): SlotNode[] =>
  scenario.diagram.nodes.filter((node): node is SlotNode => node.type === "slot");

export const slotStatus = (slot: SlotState): SlotStatus => {
  const grade = slot.evaluation?.grade;
  if (grade === undefined) return "empty";
  if (grade === "acceptable" && slot.accepted) return "accepted";
  return grade;
};

/** Green or accepted orange: counts towards completion and scores. */
export const isSlotResolved = (slot: SlotState): boolean => {
  const status = slotStatus(slot);
  return status === "optimal" || status === "accepted";
};

export const createSession = (scenario: Scenario, rules: GameRules): SessionState => {
  const slots = slotNodes(scenario).map((node): SlotState => ({
    slotId: node.id,
    placed: null,
    evaluation: null,
    accepted: false,
    errors: 0,
    placements: 0,
    hintsRevealed: 0,
  }));
  return { scenario, rules, selectedSlotId: null, slots, completed: slots.length === 0 };
};

export const applyCommand = (state: SessionState, command: Command): CommandResult => {
  const reject = (reason: RejectionReason): CommandResult => ({
    state,
    outcome: { type: "rejected", command, reason },
  });

  if (command.type === "selectSlot") {
    if (command.slotId !== null && !state.slots.some((s) => s.slotId === command.slotId)) {
      return reject("unknown-slot");
    }
    return {
      state: { ...state, selectedSlotId: command.slotId },
      outcome: { type: "slotSelected", slotId: command.slotId },
    };
  }

  if (state.completed) return reject("session-completed");
  const slot = state.slots.find((s) => s.slotId === command.slotId);
  const node = slotNodes(state.scenario).find((n) => n.id === command.slotId);
  if (slot === undefined || node === undefined) return reject("unknown-slot");

  const status = slotStatus(slot);
  if (status === "optimal") return reject("slot-locked");
  const update = (next: SlotState, outcome: CommandOutcome): CommandResult => {
    const slots = state.slots.map((s) => (s.slotId === next.slotId ? next : s));
    return {
      state: { ...state, slots, completed: slots.every(isSlotResolved) },
      outcome,
    };
  };

  switch (command.type) {
    case "placeService": {
      if (status === "accepted") return reject("slot-accepted");
      if (slot.placed === command.serviceId) return reject("already-placed");
      const evaluation = evaluatePlacement(node, command.serviceId);
      return update(
        {
          ...slot,
          placed: command.serviceId,
          evaluation,
          accepted: false,
          errors: slot.errors + (evaluation.grade === "incorrect" ? 1 : 0),
          placements: slot.placements + 1,
        },
        { type: "servicePlaced", slotId: slot.slotId, evaluation },
      );
    }
    case "acceptAcceptable":
      if (status !== "acceptable") return reject("not-acceptable");
      return update(
        { ...slot, accepted: true },
        { type: "acceptableAccepted", slotId: slot.slotId },
      );
    case "useHint": {
      if (status === "accepted") return reject("slot-accepted");
      const hint = node.hints[slot.hintsRevealed];
      if (hint === undefined) return reject("no-hints-left");
      return update(
        { ...slot, hintsRevealed: slot.hintsRevealed + 1 },
        { type: "hintRevealed", slotId: slot.slotId, hint, index: slot.hintsRevealed },
      );
    }
    case "clearSlot":
      if (status === "empty") return reject("slot-empty");
      return update(
        { ...slot, placed: null, evaluation: null, accepted: false },
        { type: "slotCleared", slotId: slot.slotId },
      );
  }
};

/** Hints revealed so far for a slot, in order. */
export const revealedHints = (state: SessionState, slotId: string): readonly string[] => {
  const slot = state.slots.find((s) => s.slotId === slotId);
  const node = slotNodes(state.scenario).find((n) => n.id === slotId);
  return slot === undefined || node === undefined ? [] : node.hints.slice(0, slot.hintsRevealed);
};
