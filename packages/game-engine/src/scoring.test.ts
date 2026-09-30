// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { scenarioResult, slotPoints } from "./scoring.js";
import {
  applyCommand,
  commands,
  createSession,
  type Command,
  type SessionState,
} from "./session.js";
import { gameRules, scenario, slot } from "./testing/fixtures.js";

const play = (state: SessionState, ...cmds: Command[]): SessionState =>
  cmds.reduce((current, cmd) => applyCommand(current, cmd).state, state);

const oneSlot = (hints = ["h1", "h2", "h3"]) =>
  createSession(scenario([slot("a", { hints })]), gameRules);

const pointsAfter = (...cmds: Command[]) => {
  const state = play(oneSlot(), ...cmds);
  const [first] = state.slots;
  if (first === undefined) throw new Error("no slot");
  return slotPoints(first, gameRules.scoring);
};

const red = (service = "ec2") => [commands.placeService("a", service), commands.clearSlot("a")];

describe("slotPoints (docs/01 Reglas de puntaje)", () => {
  it("gives 100 for a green at the first attempt", () => {
    expect(pointsAfter(commands.placeService("a", "lambda"))).toBe(100);
  });

  it("gives max(25, 100 − 25·N) for a green after N reds", () => {
    expect(pointsAfter(...red(), commands.placeService("a", "lambda"))).toBe(75);
    expect(pointsAfter(...red(), ...red("route53"), commands.placeService("a", "lambda"))).toBe(50);
    expect(
      pointsAfter(
        ...red(),
        ...red(),
        ...red(),
        ...red(),
        ...red(),
        commands.placeService("a", "lambda"),
      ),
    ).toBe(25);
  });

  it("does not penalize trying another service after an orange", () => {
    expect(
      pointsAfter(
        commands.placeService("a", "fargate"),
        commands.clearSlot("a"),
        commands.placeService("a", "lambda"),
      ),
    ).toBe(100);
  });

  it("gives 50 for an accepted orange and 0 for an unaccepted one", () => {
    const orange = commands.placeService("a", "fargate");
    expect(pointsAfter(orange, commands.acceptAcceptable("a"))).toBe(50);
    expect(pointsAfter(orange)).toBe(0);
    expect(pointsAfter(...red(), orange, commands.acceptAcceptable("a"))).toBe(50);
  });

  it("gives 0 for an empty or red slot", () => {
    expect(pointsAfter()).toBe(0);
    expect(pointsAfter(commands.placeService("a", "ec2"))).toBe(0);
  });

  it("subtracts 15 per hint, never below 0", () => {
    const hint = commands.useHint("a");
    expect(pointsAfter(hint, commands.placeService("a", "lambda"))).toBe(85);
    expect(
      pointsAfter(
        hint,
        hint,
        commands.placeService("a", "fargate"),
        commands.acceptAcceptable("a"),
      ),
    ).toBe(20);
    expect(
      pointsAfter(
        hint,
        hint,
        hint,
        commands.placeService("a", "fargate"),
        commands.acceptAcceptable("a"),
      ),
    ).toBe(5);
    expect(
      pointsAfter(...red(), ...red(), ...red(), hint, hint, commands.placeService("a", "lambda")),
    ).toBe(0);
  });

  it("takes every number from game-rules", () => {
    const scoring = {
      firstTryGreen: 10,
      greenAfterErrors: { penaltyPerError: 4, min: 3 },
      acceptedAcceptable: 7,
      hintCost: 1,
    };
    const base = {
      slotId: "a",
      accepted: false,
      placements: 1,
      hintsRevealed: 1,
      revealed: false,
    };
    const green = {
      ...base,
      placed: "lambda",
      evaluation: {
        source: "answer",
        grade: "optimal",
        serviceId: "lambda",
        rationale: "",
        objectives: [],
        references: [],
      },
    } as const;
    expect(slotPoints({ ...green, errors: 0 }, scoring)).toBe(9);
    expect(slotPoints({ ...green, errors: 1 }, scoring)).toBe(5);
    expect(slotPoints({ ...green, errors: 5 }, scoring)).toBe(2);
    expect(
      slotPoints(
        {
          ...green,
          errors: 0,
          accepted: true,
          evaluation: { ...green.evaluation, grade: "acceptable" },
        },
        scoring,
      ),
    ).toBe(6);
  });
});

describe("scenarioResult", () => {
  it("adds slot points, applies the level multiplier and rounds the XP at the end", () => {
    const session = createSession(
      scenario([slot("a"), slot("b"), slot("c")], { level: 200, areas: ["serverless", "storage"] }),
      gameRules,
    );
    const state = play(
      session,
      commands.placeService("a", "ec2"),
      commands.placeService("a", "lambda"), // 75
      commands.useHint("b"),
      commands.placeService("b", "lambda"), // 85
      commands.placeService("c", "fargate"),
      commands.acceptAcceptable("c"), // 50
    );
    const result = scenarioResult(state);
    expect(result).toMatchObject({
      scenarioId: "test-scenario",
      version: 1,
      level: 200,
      areas: ["serverless", "storage"],
      completed: true,
      score: 210,
      maxScore: 300,
      multiplier: 1.5,
      xp: 315,
      hintsUsed: 1,
      perfect: false,
    });
    expect(result.slots.map((s) => [s.slotId, s.grade, s.points, s.firstTry])).toEqual([
      ["a", "optimal", 75, false],
      ["b", "optimal", 85, true],
      ["c", "acceptable", 50, false],
    ]);
  });

  it("rounds half-points of XP to the nearest integer", () => {
    const state = play(
      createSession(scenario([slot("a")], { level: 200 }), gameRules),
      commands.useHint("a"),
      commands.placeService("a", "lambda"),
    );
    expect(scenarioResult(state)).toMatchObject({ score: 85, xp: 128 }); // 127.5
  });

  it("marks a scenario perfect only when every slot is green at the first attempt", () => {
    const green = play(
      createSession(scenario([slot("a"), slot("b")], { level: 400 }), gameRules),
      commands.useHint("a"),
      commands.placeService("a", "lambda"),
      commands.placeService("b", "lambda"),
    );
    expect(scenarioResult(green)).toMatchObject({ perfect: true, score: 185, xp: 555 });

    const retried = play(
      createSession(scenario([slot("a")]), gameRules),
      commands.placeService("a", "fargate"),
      commands.clearSlot("a"),
      commands.placeService("a", "lambda"),
    );
    expect(scenarioResult(retried)).toMatchObject({ perfect: false, score: 100 });
  });

  it("gives 0 for a viewed solution and never counts it as green (RF-PLAY-14)", () => {
    const state = play(
      createSession(scenario([slot("a"), slot("b"), slot("c")], { level: 200 }), gameRules),
      commands.placeService("a", "lambda"), // 100
      commands.useHint("b"),
      commands.placeService("b", "ec2"),
      commands.revealSolution("b"), // 0, not 100 − 25 − 15
      commands.revealSolution("c"), // 0, never placed
    );
    const result = scenarioResult(state);
    expect(result).toMatchObject({
      completed: true,
      score: 100,
      xp: 150,
      solutionsViewed: 2,
      hintsUsed: 1,
      perfect: false,
    });
    expect(result.slots.map((s) => [s.slotId, s.grade, s.revealed, s.points, s.firstTry])).toEqual([
      ["a", "optimal", false, 100, true],
      ["b", "optimal", true, 0, false],
      ["c", "optimal", true, 0, false],
    ]);
  });

  it("is not perfect when every slot was revealed", () => {
    const state = play(
      createSession(scenario([slot("a"), slot("b")]), gameRules),
      commands.revealSolution(null),
    );
    expect(scenarioResult(state)).toMatchObject({
      completed: true,
      perfect: false,
      score: 0,
      xp: 0,
      solutionsViewed: 2,
    });
  });

  it("reports an unfinished session as not completed", () => {
    const state = play(
      createSession(scenario([slot("a"), slot("b")]), gameRules),
      commands.placeService("a", "lambda"),
    );
    expect(scenarioResult(state)).toMatchObject({ completed: false, perfect: false, score: 100 });
  });
});
