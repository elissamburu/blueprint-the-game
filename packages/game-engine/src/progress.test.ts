// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  applyScenarioResult,
  compareWithBest,
  createProgress,
  markScenarioStarted,
  rankForXp,
  rankProgress,
  refreshUnlocks,
  unlockedLevelsByArea,
  updatePreferences,
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
  solutionsViewed: 0,
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
    expect(
      createProgress({ experience: "beginner", interests: ["data"] }, scenarios, gameRules),
    ).toEqual({
      experience: "beginner",
      interests: ["data"],
      xp: 0,
      best: {},
      unlocked: [
        { area: "data", level: 0 },
        { area: "data", level: 100 },
        { area: "serverless", level: 0 },
        { area: "serverless", level: 100 },
      ],
      started: [],
    });
  });

  it("opens the levels of each experience of game-rules", () => {
    const levels = (experience: PlayerProgress["experience"]) => [
      ...new Set(
        createProgress({ experience, interests: [] }, scenarios, gameRules).unlocked.map(
          (u) => u.level,
        ),
      ),
    ];
    expect(levels("newcomer")).toEqual([0]);
    expect(levels("beginner")).toEqual([0, 100]);
    expect(levels("aws-user")).toEqual([0, 100, 200]);
    expect(levels("architect")).toEqual([0, 100, 200, 300]);
    expect(levels("expert")).toEqual([0, 100, 200, 300, 400]);
  });

  it("keeps each area of interest once", () => {
    const progress = createProgress(
      { experience: "beginner", interests: ["data", "serverless", "data"] },
      scenarios,
      gameRules,
    );
    expect(progress.interests).toEqual(["data", "serverless"]);
  });
});

describe("markScenarioStarted", () => {
  it("adds the scenario once and returns the same progress when it was already started", () => {
    const progress = createProgress(
      { experience: "beginner", interests: [] },
      scenarios,
      gameRules,
    );
    const started = markScenarioStarted(progress, "s-100");
    expect(started.started).toEqual(["s-100"]);
    expect(markScenarioStarted(started, "s-100")).toBe(started);
    expect(progress.started).toEqual([]);
  });
});

describe("applyScenarioResult", () => {
  const start = () =>
    createProgress({ experience: "beginner", interests: [] }, scenarios, gameRules);

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
      allOptimal: true,
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

describe("allOptimal", () => {
  const slot = (grade: "optimal" | "acceptable", revealed = false) => ({
    slotId: grade,
    serviceId: "lambda",
    grade,
    accepted: grade === "acceptable",
    revealed,
    errors: 0,
    hintsUsed: 0,
    firstTry: grade === "optimal",
    points: 100,
  });
  const start = () =>
    createProgress({ experience: "beginner", interests: [] }, scenarios, gameRules);

  it("is true when every slot ended green and false with an accepted orange", () => {
    const green = applyScenarioResult(
      start(),
      result({ slots: [slot("optimal"), slot("optimal")] }),
      gameRules,
      scenarios,
    );
    expect(green.progress.best["s-100"]?.allOptimal).toBe(true);
    const orange = applyScenarioResult(
      start(),
      result({ slots: [slot("optimal"), slot("acceptable")] }),
      gameRules,
      scenarios,
    );
    expect(orange.progress.best["s-100"]?.allOptimal).toBe(false);
  });

  it("is false with a viewed solution, even if it shows the optimal answer (RF-PLAY-14)", () => {
    const viewed = applyScenarioResult(
      start(),
      result({ slots: [slot("optimal"), slot("optimal", true)], solutionsViewed: 1 }),
      gameRules,
      scenarios,
    );
    expect(viewed.progress.best["s-100"]?.allOptimal).toBe(false);
  });

  it("is never lost when a better result with viewed solutions replaces the best", () => {
    const green = applyScenarioResult(
      start(),
      result({ xp: 100, score: 100, slots: [slot("optimal"), slot("optimal")] }),
      gameRules,
      scenarios,
    ).progress;
    const better = applyScenarioResult(
      green,
      result({ xp: 200, score: 200, slots: [slot("optimal"), slot("optimal", true)] }),
      gameRules,
      scenarios,
    );
    expect(better.progress.best["s-100"]).toMatchObject({ xp: 200, allOptimal: true });
  });
});

describe("applyScenarioResult with viewed solutions (RF-PLAY-14)", () => {
  const start = () =>
    createProgress({ experience: "beginner", interests: [] }, scenarios, gameRules);
  const viewed = (xp: number) => result({ xp, score: xp, solutionsViewed: 1, perfect: false });

  it("counts as completed: stores the result and unlocks the next level", () => {
    const { progress, events } = applyScenarioResult(start(), viewed(0), gameRules, scenarios);
    expect(progress.best["s-100"]).toMatchObject({ xp: 0, score: 0 });
    expect(events).toEqual([{ type: "levelUnlocked", level: 200, areas: ["serverless"] }]);
  });

  it("never takes XP away nor lowers the best result kept", () => {
    const first = applyScenarioResult(start(), result({ xp: 300 }), gameRules, scenarios).progress;
    const lower = applyScenarioResult(first, viewed(50), gameRules, scenarios);
    expect(lower.progress.xp).toBe(300);
    expect(lower.progress.best["s-100"]).toEqual(first.best["s-100"]);
    expect(lower.events).toEqual([]);
  });
});

describe("refreshUnlocks", () => {
  it("opens the levels of a new area without touching the rest", () => {
    const progress = createProgress(
      { experience: "aws-user", interests: [] },
      scenarios,
      gameRules,
    );
    const withNewArea = [...scenarios, { id: "ml-100", level: 100 as const, areas: ["ml"] }];
    const { progress: next, events } = refreshUnlocks(progress, withNewArea, gameRules);
    // 0, 100 and 200 by experience; "ml" has no level-200 scenarios, so 300 waits for "s-200".
    expect(next.unlocked.filter((u) => u.area === "ml").map((u) => u.level)).toEqual([0, 100, 200]);
    expect(next.unlocked.filter((u) => u.area !== "ml")).toEqual(progress.unlocked);
    expect(events).toEqual([
      { type: "levelUnlocked", level: 0, areas: ["ml"] },
      { type: "levelUnlocked", level: 100, areas: ["ml"] },
      { type: "levelUnlocked", level: 200, areas: ["ml"] },
    ]);
    expect(refreshUnlocks(next, withNewArea, gameRules).events).toEqual([]);
  });
});

describe("compareWithBest", () => {
  const withBest = (xp: number) =>
    applyScenarioResult(
      createProgress({ experience: "beginner", interests: [] }, scenarios, gameRules),
      result({ xp }),
      gameRules,
      scenarios,
    ).progress;

  it("counts all the XP of a first result", () => {
    expect(compareWithBest({ best: {} }, result({ xp: 300 }))).toEqual({
      kind: "first",
      gained: 300,
    });
  });

  it("counts only the improvement over the best", () => {
    expect(compareWithBest(withBest(200), result({ xp: 300 }))).toEqual({
      kind: "improved",
      gained: 100,
      previousXp: 200,
    });
  });

  it("adds nothing when the best was equal or higher", () => {
    expect(compareWithBest(withBest(300), result({ xp: 300 }))).toEqual({
      kind: "equal",
      gained: 0,
      previousXp: 300,
    });
    expect(compareWithBest(withBest(400), result({ xp: 300 }))).toEqual({
      kind: "lower",
      gained: 0,
      previousXp: 400,
    });
  });

  it("agrees with applyScenarioResult", () => {
    const before = withBest(200);
    const update = applyScenarioResult(before, result({ xp: 350 }), gameRules, scenarios);
    expect(update.progress.xp - before.xp).toBe(
      compareWithBest(before, result({ xp: 350 })).gained,
    );
  });
});

describe("rankProgress", () => {
  it("measures the way from the current rank to the next one, from game-rules", () => {
    expect(rankProgress(0, gameRules)).toMatchObject({
      rank: { id: "aprendiz" },
      next: { id: "constructor", minXp: 1000 },
      remaining: 1000,
      percent: 0,
    });
    expect(rankProgress(1840, gameRules)).toMatchObject({
      rank: { id: "constructor" },
      next: { id: "arquitecto", minXp: 5000 },
      remaining: 3160,
      // (1840 − 1000) / (5000 − 1000) = 21 %.
      percent: 21,
    });
    expect(rankProgress(4999, gameRules).percent).toBe(99);
    expect(rankProgress(5000, gameRules)).toMatchObject({ rank: { id: "arquitecto" }, percent: 0 });
  });

  it("has no next rank at the top", () => {
    expect(rankProgress(52000, gameRules)).toEqual({
      rank: { id: "principal", name: "Principal", minXp: 40000 },
      next: null,
      xp: 52000,
      remaining: 0,
      percent: 100,
    });
  });
});

describe("updatePreferences", () => {
  const start = createProgress(
    { experience: "aws-user", interests: ["serverless"] },
    scenarios,
    gameRules,
  );

  it("replaces the areas of interest, without repeats", () => {
    const { progress } = updatePreferences(
      start,
      { experience: "aws-user", interests: ["data", "ml", "data"] },
      scenarios,
      gameRules,
    );
    expect(progress.interests).toEqual(["data", "ml"]);
    expect(progress.unlocked).toEqual(start.unlocked);
  });

  it("opens the levels of a higher experience in every area and says so", () => {
    const update = updatePreferences(
      start,
      { experience: "architect", interests: ["serverless"] },
      scenarios,
      gameRules,
    );
    expect(update.progress.experience).toBe("architect");
    expect(update.progress.unlocked).toContainEqual({ area: "data", level: 300 });
    expect(update.progress.unlocked).toContainEqual({ area: "serverless", level: 300 });
    expect(update.events).toEqual([
      { type: "levelUnlocked", level: 300, areas: ["data", "serverless"] },
    ]);
  });

  it("never closes a level with a lower experience", () => {
    const update = updatePreferences(
      start,
      { experience: "beginner", interests: ["serverless"] },
      scenarios,
      gameRules,
    );
    expect(update.progress.experience).toBe("beginner");
    expect(update.progress.unlocked).toEqual(start.unlocked);
    expect(update.progress.unlocked).toContainEqual({ area: "serverless", level: 200 });
    expect(update.events).toEqual([]);
  });

  it("keeps XP, best results and started scenarios", () => {
    const played = applyScenarioResult(
      markScenarioStarted(start, "s-100"),
      result(),
      gameRules,
      scenarios,
    ).progress;
    const { progress } = updatePreferences(
      played,
      { experience: "expert", interests: [] },
      scenarios,
      gameRules,
    );
    expect(progress.xp).toBe(played.xp);
    expect(progress.best).toEqual(played.best);
    expect(progress.started).toEqual(played.started);
  });
});

describe("unlockedLevelsByArea", () => {
  it("groups the open levels by area in the given order, sorted and without repeats", () => {
    expect(
      unlockedLevelsByArea(
        [
          { area: "serverless", level: 200 },
          { area: "data", level: 100 },
          { area: "serverless", level: 100 },
          { area: "serverless", level: 100 },
          { area: "ml", level: 100 },
        ],
        ["serverless", "networking", "data"],
      ),
    ).toEqual([
      { area: "serverless", levels: [100, 200] },
      { area: "data", levels: [100] },
      // Areas missing from the list (e.g. removed from areas.yaml) go last.
      { area: "ml", levels: [100] },
    ]);
  });
});
