// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  applyScenarioResult,
  createProgress,
  rankForXp,
  refreshUnlocks,
  type PlayerProgress,
} from "./progress.js";
import type { ScenarioResult } from "./scoring.js";
import { gameRules } from "./testing/fixtures.js";
import type { ScenarioInfo } from "./unlocks.js";

const scenarios: ScenarioInfo[] = [
  { id: "s-100", level: 100, areas: ["serverless"] },
  { id: "s-200", level: 200, areas: ["serverless", "data"] },
  { id: "d-100", level: 100, areas: ["data"] },
];

const result = (overrides: Partial<ScenarioResult> = {}): ScenarioResult => ({
  scenarioId: "s-100",
  version: 1,
  level: 100,
  areas: ["serverless"],
  completed: true,
  score: 300,
  maxScore: 400,
  multiplier: 1,
  xp: 300,
  hintsUsed: 1,
  perfect: false,
  slots: [],
  ...overrides,
});

describe("rankForXp", () => {
  it("returns the highest rank reached, from the thresholds of game-rules", () => {
    expect(rankForXp(0, gameRules).id).toBe("aprendiz");
    expect(rankForXp(999, gameRules).id).toBe("aprendiz");
    expect(rankForXp(1000, gameRules).id).toBe("constructor");
    expect(rankForXp(40000, gameRules).id).toBe("principal");
  });

  it("falls back to the lowest rank and fails without ranks", () => {
    const ranks = [
      { id: "b", name: "B", minXp: 50 },
      { id: "a", name: "A", minXp: 10 },
    ];
    expect(rankForXp(0, { ranks }).id).toBe("a");
    expect(rankForXp(60, { ranks }).id).toBe("b");
    expect(() => rankForXp(0, { ranks: [] })).toThrow();
  });
});

describe("createProgress", () => {
  it("starts with no XP and the experience levels open in every area", () => {
    expect(createProgress("beginner", scenarios, gameRules)).toEqual({
      experience: "beginner",
      xp: 0,
      best: {},
      unlocked: [
        { area: "data", level: 100 },
        { area: "serverless", level: 100 },
      ],
    });
  });
});

describe("applyScenarioResult", () => {
  const start = () => createProgress("beginner", scenarios, gameRules);

  it("ignores an unfinished result", () => {
    const progress = start();
    expect(
      applyScenarioResult(progress, result({ completed: false }), gameRules, scenarios),
    ).toEqual({
      progress,
      events: [],
    });
  });

  it("stores the best result, adds its XP and unlocks the next level of its areas", () => {
    const { progress, events } = applyScenarioResult(start(), result(), gameRules, scenarios);
    expect(progress.xp).toBe(300);
    expect(progress.best["s-100"]).toEqual({
      version: 1,
      level: 100,
      areas: ["serverless"],
      score: 300,
      maxScore: 400,
      xp: 300,
      hintsUsed: 1,
      perfect: false,
    });
    expect(events).toEqual([
      { type: "xpGained", amount: 300, total: 300 },
      { type: "levelUnlocked", level: 200, areas: ["serverless"] },
    ]);
  });

  it("only adds the improvement over the best result and never loses XP", () => {
    const first = applyScenarioResult(start(), result({ xp: 300 }), gameRules, scenarios).progress;

    const worse = applyScenarioResult(first, result({ xp: 100, score: 100 }), gameRules, scenarios);
    expect(worse.progress.xp).toBe(300);
    expect(worse.progress.best["s-100"]?.xp).toBe(300);
    expect(worse.events).toEqual([]);

    const better = applyScenarioResult(
      first,
      result({ xp: 400, score: 400, perfect: true }),
      gameRules,
      scenarios,
    );
    expect(better.progress.xp).toBe(400);
    expect(better.progress.best["s-100"]).toMatchObject({ xp: 400, perfect: true });
    expect(better.events).toEqual([{ type: "xpGained", amount: 100, total: 400 }]);
  });

  it("emits rankUp when the XP crosses a threshold of game-rules", () => {
    const progress: PlayerProgress = { ...start(), xp: 900 };
    const { events } = applyScenarioResult(
      progress,
      result({ scenarioId: "d-100", areas: ["data"], xp: 150 }),
      gameRules,
      scenarios,
    );
    expect(events).toEqual([
      { type: "xpGained", amount: 150, total: 1050 },
      {
        type: "rankUp",
        from: { id: "aprendiz", name: "Aprendiz", minXp: 0 },
        to: { id: "constructor", name: "Constructor", minXp: 1000 },
      },
      { type: "levelUnlocked", level: 200, areas: ["data"] },
    ]);
  });
});

describe("refreshUnlocks", () => {
  it("opens the levels of a new area without touching the rest", () => {
    const progress = createProgress("aws-user", scenarios, gameRules);
    const withNewArea = [...scenarios, { id: "ml-100", level: 100 as const, areas: ["ml"] }];
    const { progress: next, events } = refreshUnlocks(progress, withNewArea, gameRules);
    // 100 and 200 by experience; "ml" has no scenarios at 200 or 300, so 300 and 400 follow.
    expect(next.unlocked.filter((u) => u.area === "ml").map((u) => u.level)).toEqual([
      100, 200, 300, 400,
    ]);
    expect(next.unlocked.filter((u) => u.area !== "ml")).toEqual(progress.unlocked);
    expect(events).toEqual(
      ([100, 200, 300, 400] as const).map((level) => ({
        type: "levelUnlocked",
        level,
        areas: ["ml"],
      })),
    );
    expect(refreshUnlocks(next, withNewArea, gameRules).events).toEqual([]);
  });
});
