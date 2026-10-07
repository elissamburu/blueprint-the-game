// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { attemptOf, recordCommand, resumeAttempt, type SavedAttempt } from "./attempt.js";
import { scenarioResult } from "./scoring.js";
import { applyCommand, commands, createSession, type Command } from "./session.js";
import { gameRules, scenario, slot } from "./testing/fixtures.js";

const twoSlots = scenario([slot("a"), slot("b")]);

/** Plays the commands like the screen does: applies each one and records the accepted ones. */
const play = (cmds: readonly Command[]) =>
  cmds.reduce(
    ({ session, recorded }, command) => {
      const { state, outcome } = applyCommand(session, command);
      return { session: state, recorded: recordCommand(recorded, command, outcome) };
    },
    { session: createSession(twoSlots, gameRules), recorded: [] as readonly Command[] },
  );

const game: Command[] = [
  commands.selectSlot("a"),
  commands.placeService("a", "ec2"),
  commands.useHint("a"),
  commands.clearSlot("a"),
  commands.selectSlot("a"),
  commands.placeService("a", "lambda"),
  commands.placeService("b", "fargate"),
  commands.acceptAcceptable("b"),
];

describe("recordCommand", () => {
  it("keeps the accepted commands that change the game, in order", () => {
    const { recorded } = play(game);
    expect(recorded).toEqual(game.filter((command) => command.type !== "selectSlot"));
  });

  it("leaves rejected commands out and returns the same array", () => {
    const { session, recorded } = play([commands.placeService("a", "lambda")]);
    const command = commands.placeService("a", "ec2");
    const { outcome } = applyCommand(session, command);
    expect(recordCommand(recorded, command, outcome)).toBe(recorded);
  });
});

describe("resumeAttempt", () => {
  it("rebuilds the same board, errors, hints and viewed solutions", () => {
    const { session, recorded } = play([
      commands.placeService("a", "ec2"),
      commands.useHint("a"),
      commands.revealSolution("b"),
    ]);
    const resumed = resumeAttempt(twoSlots, gameRules, attemptOf(twoSlots, recorded));
    expect(resumed.kind).toBe("resumed");
    expect(resumed.commands).toEqual(recorded);
    expect(resumed.session.slots).toEqual(session.slots);
    expect(resumed.session.slots[0]).toMatchObject({ errors: 1, hintsRevealed: 1 });
    expect(resumed.session.slots[1]).toMatchObject({ revealed: true });
  });

  it("never improves the score: the penalties already incurred are kept", () => {
    const { session, recorded } = play(game);
    const resumed = resumeAttempt(twoSlots, gameRules, attemptOf(twoSlots, recorded));
    expect(scenarioResult(resumed.session)).toEqual(scenarioResult(session));
    const clean = play([
      commands.placeService("a", "lambda"),
      commands.placeService("b", "lambda"),
    ]);
    expect(scenarioResult(resumed.session).score).toBeLessThan(scenarioResult(clean.session).score);
  });

  it("resumes a completed game, still to be finished", () => {
    const { session, recorded } = play(game);
    expect(session.completed).toBe(true);
    const resumed = resumeAttempt(twoSlots, gameRules, attemptOf(twoSlots, recorded));
    expect(resumed.session.completed).toBe(true);
  });

  it("starts with nothing selected", () => {
    const { recorded } = play([commands.placeService("a", "ec2"), commands.selectSlot("a")]);
    const resumed = resumeAttempt(twoSlots, gameRules, attemptOf(twoSlots, recorded));
    expect(resumed.session.selectedSlotId).toBeNull();
  });

  it("starts a new game without a saved one, or with one without commands", () => {
    const fresh = createSession(twoSlots, gameRules);
    expect(resumeAttempt(twoSlots, gameRules, null)).toEqual({
      kind: "new",
      session: fresh,
      commands: [],
    });
    expect(resumeAttempt(twoSlots, gameRules, attemptOf(twoSlots, [])).kind).toBe("new");
  });

  it("drops a game saved on another version of the scenario", () => {
    const { recorded } = play(game);
    const saved: SavedAttempt = { ...attemptOf(twoSlots, recorded), version: 2 };
    const resumed = resumeAttempt(twoSlots, gameRules, saved);
    expect(resumed).toEqual({
      kind: "outdated",
      session: createSession(twoSlots, gameRules),
      commands: [],
    });
  });

  it("drops a game of another scenario or with commands that no longer apply", () => {
    const fresh = createSession(twoSlots, gameRules);
    const invalid = (saved: SavedAttempt) => {
      const resumed = resumeAttempt(twoSlots, gameRules, saved);
      expect(resumed).toEqual({ kind: "invalid", session: fresh, commands: [] });
    };
    invalid({ ...attemptOf(twoSlots, [commands.placeService("a", "ec2")]), scenarioId: "other" });
    invalid(attemptOf(twoSlots, [commands.placeService("missing", "ec2")]));
    invalid(attemptOf(twoSlots, [commands.placeService("a", "lambda"), commands.useHint("a")]));
    invalid(attemptOf(twoSlots, [commands.selectSlot("a")]));
  });
});
