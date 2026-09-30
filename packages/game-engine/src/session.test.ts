// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  applyCommand,
  canApply,
  commands,
  createSession,
  isSlotResolved,
  revealedHints,
  slotStatus,
  type Command,
  type SessionState,
} from "./session.js";
import { gameRules, scenario, slot } from "./testing/fixtures.js";

const play = (state: SessionState, ...cmds: Command[]): SessionState =>
  cmds.reduce((current, cmd) => applyCommand(current, cmd).state, state);

const twoSlots = () => createSession(scenario([slot("a"), slot("b")]), gameRules);
const slotOf = (state: SessionState, id: string) => {
  const found = state.slots.find((s) => s.slotId === id);
  if (found === undefined) throw new Error(`no slot ${id}`);
  return found;
};

describe("createSession", () => {
  it("creates one empty slot per slot node, in diagram order", () => {
    const state = twoSlots();
    expect(state.slots.map((s) => s.slotId)).toEqual(["a", "b"]);
    expect(state.slots.every((s) => slotStatus(s) === "empty")).toBe(true);
    expect(state.selectedSlotId).toBeNull();
    expect(state.completed).toBe(false);
  });

  it("is completed from the start when the scenario has no slots", () => {
    expect(createSession(scenario([]), gameRules).completed).toBe(true);
  });
});

describe("applyCommand", () => {
  it("selects and deselects slots, rejecting unknown ids", () => {
    const selected = applyCommand(twoSlots(), commands.selectSlot("b"));
    expect(selected.state.selectedSlotId).toBe("b");
    expect(selected.outcome).toEqual({ type: "slotSelected", slotId: "b" });
    expect(applyCommand(selected.state, commands.selectSlot(null)).state.selectedSlotId).toBeNull();

    const unknown = applyCommand(selected.state, commands.selectSlot("zzz"));
    expect(unknown.state).toBe(selected.state);
    expect(unknown.outcome).toMatchObject({ type: "rejected", reason: "unknown-slot" });
  });

  it("places a service and returns its evaluation", () => {
    const { state, outcome } = applyCommand(twoSlots(), commands.placeService("a", "lambda"));
    expect(outcome).toMatchObject({
      type: "servicePlaced",
      slotId: "a",
      evaluation: { grade: "optimal", objectives: ["no-servers"] },
    });
    expect(slotOf(state, "a")).toMatchObject({ placed: "lambda", errors: 0, placements: 1 });
    expect(slotStatus(slotOf(state, "a"))).toBe("optimal");
  });

  it("counts only red placements as errors", () => {
    const state = play(
      twoSlots(),
      commands.placeService("a", "ec2"),
      commands.placeService("a", "fargate"),
      commands.placeService("a", "sns"),
      commands.clearSlot("a"),
      commands.placeService("a", "fargate"),
    );
    expect(slotOf(state, "a")).toMatchObject({ errors: 2, placements: 4, placed: "fargate" });
  });

  it("rejects placing the service already placed, without a new error", () => {
    const first = applyCommand(twoSlots(), commands.placeService("a", "ec2")).state;
    const again = applyCommand(first, commands.placeService("a", "ec2"));
    expect(again.state).toBe(first);
    expect(again.outcome).toMatchObject({ reason: "already-placed" });
  });

  it("locks a green slot", () => {
    const green = applyCommand(twoSlots(), commands.placeService("a", "lambda")).state;
    for (const cmd of [
      commands.placeService("a", "fargate"),
      commands.useHint("a"),
      commands.clearSlot("a"),
      commands.acceptAcceptable("a"),
    ]) {
      expect(applyCommand(green, cmd).outcome).toMatchObject({ reason: "slot-locked" });
    }
  });

  it("accepts only an orange, and an accepted orange needs clearSlot to try another", () => {
    const empty = twoSlots();
    expect(applyCommand(empty, commands.acceptAcceptable("a")).outcome).toMatchObject({
      reason: "not-acceptable",
    });
    const red = applyCommand(empty, commands.placeService("a", "ec2")).state;
    expect(applyCommand(red, commands.acceptAcceptable("a")).outcome).toMatchObject({
      reason: "not-acceptable",
    });

    const accepted = play(
      empty,
      commands.placeService("a", "fargate"),
      commands.acceptAcceptable("a"),
    );
    expect(slotStatus(slotOf(accepted, "a"))).toBe("accepted");
    expect(applyCommand(accepted, commands.acceptAcceptable("a")).outcome).toMatchObject({
      reason: "not-acceptable",
    });
    expect(applyCommand(accepted, commands.placeService("a", "lambda")).outcome).toMatchObject({
      reason: "slot-accepted",
    });
    expect(applyCommand(accepted, commands.useHint("a")).outcome).toMatchObject({
      reason: "slot-accepted",
    });

    const cleared = applyCommand(accepted, commands.clearSlot("a"));
    expect(cleared.outcome).toEqual({ type: "slotCleared", slotId: "a" });
    expect(slotOf(cleared.state, "a")).toMatchObject({ placed: null, accepted: false });
  });

  it("reveals hints one by one until there are none left", () => {
    const first = applyCommand(twoSlots(), commands.useHint("a"));
    expect(first.outcome).toEqual({ type: "hintRevealed", slotId: "a", hint: "Pista 1", index: 0 });
    const second = applyCommand(first.state, commands.useHint("a"));
    expect(second.outcome).toMatchObject({ hint: "Pista 2", index: 1 });
    expect(revealedHints(second.state, "a")).toEqual(["Pista 1", "Pista 2"]);
    expect(revealedHints(second.state, "b")).toEqual([]);
    expect(revealedHints(second.state, "zzz")).toEqual([]);
    expect(applyCommand(second.state, commands.useHint("a")).outcome).toMatchObject({
      reason: "no-hints-left",
    });
  });

  it("rejects clearing an empty slot and commands on unknown slots", () => {
    const state = twoSlots();
    expect(applyCommand(state, commands.clearSlot("a")).outcome).toMatchObject({
      reason: "slot-empty",
    });
    expect(applyCommand(state, commands.useHint("zzz")).outcome).toMatchObject({
      reason: "unknown-slot",
    });
  });

  it("completes when every slot is green or an accepted orange, then rejects commands", () => {
    const almost = play(
      twoSlots(),
      commands.placeService("a", "lambda"),
      commands.placeService("b", "fargate"),
    );
    expect(almost.completed).toBe(false);
    const done = applyCommand(almost, commands.acceptAcceptable("b")).state;
    expect(done.completed).toBe(true);
    expect(applyCommand(done, commands.clearSlot("b")).outcome).toMatchObject({
      reason: "session-completed",
    });
    expect(applyCommand(done, commands.selectSlot("a")).state.selectedSlotId).toBe("a");
  });

  it("never mutates the previous state", () => {
    const before = twoSlots();
    const snapshot = structuredClone(before.slots);
    applyCommand(before, commands.placeService("a", "ec2"));
    expect(before.slots).toEqual(snapshot);
  });
});

describe("revealSolution (RF-PLAY-14, ADR-0024)", () => {
  it("shows the first optimal answer of the slot and locks it, keeping errors and hints", () => {
    const before = play(
      twoSlots(),
      commands.useHint("a"),
      commands.placeService("a", "ec2"),
      commands.clearSlot("a"),
      commands.placeService("a", "fargate"),
      commands.selectSlot("a"),
    );
    const { state, outcome } = applyCommand(before, commands.revealSolution("a"));
    expect(outcome).toEqual({
      type: "solutionRevealed",
      revealed: [{ slotId: "a", serviceId: "lambda" }],
    });
    expect(slotOf(state, "a")).toMatchObject({
      placed: "lambda",
      evaluation: { source: "answer", grade: "optimal", objectives: ["no-servers"] },
      accepted: false,
      revealed: true,
      errors: 1,
      placements: 2,
      hintsRevealed: 1,
    });
    expect(slotStatus(slotOf(state, "a"))).toBe("revealed");
    expect(isSlotResolved(slotOf(state, "a"))).toBe(true);
    // The revealed slot is no longer the target of the keyboard/tap flow.
    expect(state.selectedSlotId).toBeNull();
    expect(state.completed).toBe(false);
    for (const cmd of [
      commands.placeService("a", "fargate"),
      commands.useHint("a"),
      commands.clearSlot("a"),
      commands.acceptAcceptable("a"),
      commands.revealSolution("a"),
    ]) {
      expect(applyCommand(state, cmd).outcome).toMatchObject({ reason: "slot-locked" });
    }
  });

  it("keeps the selection of another slot", () => {
    const state = play(twoSlots(), commands.selectSlot("b"), commands.revealSolution("a"));
    expect(state.selectedSlotId).toBe("b");
  });

  it("reveals an empty slot, and falls back to the first answer without an optimal one", () => {
    const onlyOrange = slot("c", {
      answers: [
        {
          service: "fargate",
          grade: "acceptable",
          objectives: ["low-cost"],
          rationale: "Aceptable.",
          references: [],
        },
      ],
    });
    const session = createSession(scenario([slot("a"), onlyOrange]), gameRules);
    const state = play(session, commands.revealSolution("a"), commands.revealSolution("c"));
    expect(slotOf(state, "a")).toMatchObject({ placed: "lambda", placements: 0, revealed: true });
    expect(slotOf(state, "c")).toMatchObject({ placed: "fargate", revealed: true });
    expect(state.completed).toBe(true);
  });

  it("does nothing on a slot that is already resolved", () => {
    const green = play(twoSlots(), commands.placeService("a", "lambda"));
    const onGreen = applyCommand(green, commands.revealSolution("a"));
    expect(onGreen.state).toBe(green);
    expect(onGreen.outcome).toMatchObject({ type: "rejected", reason: "slot-locked" });

    const accepted = play(
      twoSlots(),
      commands.placeService("a", "fargate"),
      commands.acceptAcceptable("a"),
    );
    const onAccepted = applyCommand(accepted, commands.revealSolution("a"));
    expect(onAccepted.state).toBe(accepted);
    expect(onAccepted.outcome).toMatchObject({ reason: "slot-locked" });
    expect(applyCommand(accepted, commands.revealSolution("zzz")).outcome).toMatchObject({
      reason: "unknown-slot",
    });
  });

  it("with null reveals every unresolved slot at once and completes the session", () => {
    const before = play(
      createSession(scenario([slot("a"), slot("b"), slot("c"), slot("d")]), gameRules),
      commands.placeService("a", "lambda"),
      commands.placeService("b", "fargate"),
      commands.acceptAcceptable("b"),
      commands.useHint("c"),
      commands.placeService("c", "ec2"),
      commands.selectSlot("d"),
    );
    const { state, outcome } = applyCommand(before, commands.revealSolution(null));
    expect(outcome).toEqual({
      type: "solutionRevealed",
      revealed: [
        { slotId: "c", serviceId: "lambda" },
        { slotId: "d", serviceId: "lambda" },
      ],
    });
    expect(state.slots.map(slotStatus)).toEqual(["optimal", "accepted", "revealed", "revealed"]);
    expect(slotOf(state, "c")).toMatchObject({ placed: "lambda", errors: 1, hintsRevealed: 1 });
    expect(state.selectedSlotId).toBeNull();
    expect(state.completed).toBe(true);
    expect(applyCommand(state, commands.revealSolution(null)).outcome).toMatchObject({
      reason: "session-completed",
    });
  });

  it("never mutates the previous state", () => {
    const before = play(twoSlots(), commands.placeService("a", "ec2"));
    const snapshot = structuredClone(before.slots);
    applyCommand(before, commands.revealSolution("a"));
    applyCommand(before, commands.revealSolution(null));
    expect(before.slots).toEqual(snapshot);
  });
});

describe("canApply", () => {
  it("tells whether applyCommand would accept the command, without changing the state", () => {
    const state = twoSlots();
    expect(canApply(state, commands.useHint("a"))).toBe(true);
    expect(canApply(state, commands.clearSlot("a"))).toBe(false);
    const green = play(state, commands.placeService("a", "lambda"));
    expect(canApply(green, commands.useHint("a"))).toBe(false);
    expect(canApply(green, commands.placeService("a", "fargate"))).toBe(false);
    expect(canApply(state, commands.revealSolution("a"))).toBe(true);
    expect(canApply(green, commands.revealSolution("a"))).toBe(false);
    expect(slotStatus(slotOf(state, "a"))).toBe("empty");
  });
});
