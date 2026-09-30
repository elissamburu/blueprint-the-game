// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game session as a pure reducer over the commands of ADR-0008 and ADR-0024 (revealSolution).
// Drag, tap and keyboard adapters emit the same commands; the UI renders the state and never
// decides grades.
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
  /**
   * The player asked to see the solution (RF-PLAY-14): the slot holds its optimal answer, is
   * locked and scores 0. `errors`, `placements` and `hintsRevealed` keep what happened before.
   */
  readonly revealed: boolean;
}

/**
 * - `empty`: nothing placed.
 * - `incorrect` / `acceptable`: red or orange placed; the player can retry (RF-PLAY-07).
 * - `accepted`: orange kept by the player; resolved until `clearSlot`.
 * - `optimal`: green; the service is shown and the slot locked (RF-EVAL-04).
 * - `revealed`: "Solución vista" (RF-PLAY-14); shows the optimal answer like a green and is
 *   locked, but it is not a green: it scores 0 and is never a first-try green.
 */
export type SlotStatus = "empty" | "incorrect" | "acceptable" | "accepted" | "optimal" | "revealed";

export interface SessionState {
  readonly scenario: Scenario;
  readonly rules: GameRules;
  readonly selectedSlotId: string | null;
  /** One entry per slot, in diagram order. */
  readonly slots: readonly SlotState[];
  /**
   * Every slot is green, an accepted orange (RF-PLAY-08) or revealed (RF-PLAY-14). Commands are
   * rejected afterwards.
   */
  readonly completed: boolean;
}

export type Command =
  | { type: "selectSlot"; slotId: string | null }
  | { type: "placeService"; slotId: string; serviceId: string }
  | { type: "acceptAcceptable"; slotId: string }
  | { type: "useHint"; slotId: string }
  | { type: "clearSlot"; slotId: string }
  /** Shows the solution of one slot, or of every unresolved slot with `slotId: null` (ADR-0024). */
  | { type: "revealSolution"; slotId: string | null };

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
  /** One slot, or every unresolved slot with null ("Ver solución completa"). */
  revealSolution: (slotId: string | null): Command => ({ type: "revealSolution", slotId }),
} as const;

export type RejectionReason =
  | "session-completed"
  | "unknown-slot"
  /** The slot is green or its solution was viewed; for revealSolution, any resolved slot. */
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
  /** Slots whose solution is now shown and the service each one shows, in diagram order. */
  | { type: "solutionRevealed"; revealed: readonly RevealedSlot[] }
  | { type: "rejected"; command: Command; reason: RejectionReason };

export interface RevealedSlot {
  readonly slotId: string;
  readonly serviceId: string;
}

export interface CommandResult {
  /** New state; the same object when the command is rejected. */
  readonly state: SessionState;
  readonly outcome: CommandOutcome;
}

export const slotNodes = (scenario: Pick<Scenario, "diagram">): SlotNode[] =>
  scenario.diagram.nodes.filter((node): node is SlotNode => node.type === "slot");

export const slotStatus = (slot: SlotState): SlotStatus => {
  if (slot.revealed) return "revealed";
  const grade = slot.evaluation?.grade;
  if (grade === undefined) return "empty";
  if (grade === "acceptable" && slot.accepted) return "accepted";
  return grade;
};

/**
 * Green, accepted orange or revealed: counts towards completion. A revealed slot scores 0
 * (see `slotPoints`).
 */
export const isSlotResolved = (slot: SlotState): boolean => {
  const status = slotStatus(slot);
  return status === "optimal" || status === "accepted" || status === "revealed";
};

/** Answer a revealed slot shows: its first optimal answer (lint L003 guarantees one). */
const solutionOf = (node: SlotNode) =>
  node.answers.find((answer) => answer.grade === "optimal") ?? node.answers[0];

/** The slot with its solution shown. The history (errors, placements, hints) is kept. */
const reveal = (slot: SlotState, node: SlotNode): SlotState => {
  const solution = solutionOf(node);
  if (solution === undefined) return slot;
  return {
    ...slot,
    placed: solution.service,
    evaluation: evaluatePlacement(node, solution.service),
    accepted: false,
    revealed: true,
  };
};

const revealedSlot = (slot: SlotState): RevealedSlot => ({
  slotId: slot.slotId,
  serviceId: slot.placed ?? "",
});

export const createSession = (scenario: Scenario, rules: GameRules): SessionState => {
  const slots = slotNodes(scenario).map((node): SlotState => ({
    slotId: node.id,
    placed: null,
    evaluation: null,
    accepted: false,
    errors: 0,
    placements: 0,
    hintsRevealed: 0,
    revealed: false,
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
  if (command.type === "revealSolution" && command.slotId === null) {
    // Every unresolved slot at once; the session is not completed, so there is at least one.
    const nodes = new Map(slotNodes(state.scenario).map((n) => [n.id, n]));
    const revealed: RevealedSlot[] = [];
    const slots = state.slots.map((s) => {
      const node = nodes.get(s.slotId);
      if (isSlotResolved(s) || node === undefined) return s;
      const next = reveal(s, node);
      revealed.push(revealedSlot(next));
      return next;
    });
    return {
      state: { ...state, slots, selectedSlotId: null, completed: slots.every(isSlotResolved) },
      outcome: { type: "solutionRevealed", revealed },
    };
  }
  const slot = state.slots.find((s) => s.slotId === command.slotId);
  const node = slotNodes(state.scenario).find((n) => n.id === command.slotId);
  if (slot === undefined || node === undefined) return reject("unknown-slot");

  const status = slotStatus(slot);
  if (status === "optimal" || status === "revealed") return reject("slot-locked");
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
    case "revealSolution": {
      if (status === "accepted") return reject("slot-locked");
      const next = reveal(slot, node);
      const result = update(next, { type: "solutionRevealed", revealed: [revealedSlot(next)] });
      // The slot is no longer a target for a service.
      return state.selectedSlotId === slot.slotId
        ? { ...result, state: { ...result.state, selectedSlotId: null } }
        : result;
    }
  }
};

/**
 * The command would be accepted in this state. Lets the UI enable or hide a control (e.g. "Ver
 * pista") without repeating the rules of `applyCommand`.
 */
export const canApply = (state: SessionState, command: Command): boolean =>
  applyCommand(state, command).outcome.type !== "rejected";

/** Hints revealed so far for a slot, in order. */
export const revealedHints = (state: SessionState, slotId: string): readonly string[] => {
  const slot = state.slots.find((s) => s.slotId === slotId);
  const node = slotNodes(state.scenario).find((n) => n.id === slotId);
  return slot === undefined || node === undefined ? [] : node.hints.slice(0, slot.hintsRevealed);
};
