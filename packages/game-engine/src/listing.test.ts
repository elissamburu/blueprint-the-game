// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { lockReason, recommendedScenario, scenarioStatus } from "./listing.js";
import { createProgress, type BestResult, type PlayerProgress } from "./progress.js";
import { gameRules } from "./testing/fixtures.js";
import type { LevelUnlock, ScenarioInfo } from "./unlocks.js";

const best = (overrides: Partial<BestResult> = {}): BestResult => ({
  version: 1,
  level: 100,
  areas: ["serverless"],
  score: 100,
  maxScore: 100,
  xp: 100,
  hintsUsed: 0,
  perfect: true,
  allOptimal: true,
  ...overrides,
});

const open = (area: string, ...levels: LevelUnlock["level"][]): LevelUnlock[] =>
  levels.map((level) => ({ area, level }));

const player = (overrides: Partial<PlayerProgress> = {}): PlayerProgress => ({
  experience: "beginner",
  interests: ["serverless"],
  xp: 0,
  best: {},
  unlocked: [],
  started: [],
  ...overrides,
});

describe("scenarioStatus", () => {
  it("is new, in progress, completed green or completed with oranges", () => {
    const progress = player({
      started: ["started", "green"],
      best: {
        green: best(),
        orange: best({ allOptimal: false, perfect: false }),
      },
    });
    expect(scenarioStatus(progress, "other")).toBe("new");
    expect(scenarioStatus(progress, "started")).toBe("in-progress");
    // A completed scenario is completed even if it was started before.
    expect(scenarioStatus(progress, "green")).toBe("completed-green");
    expect(scenarioStatus(progress, "orange")).toBe("completed");
  });
});

describe("recommendedScenario", () => {
  const scenarios: ScenarioInfo[] = [
    { id: "sl-100-a", level: 100, areas: ["serverless"] },
    { id: "sl-100-b", level: 100, areas: ["serverless", "storage"] },
    { id: "sl-200", level: 200, areas: ["serverless"] },
    { id: "net-200", level: 200, areas: ["networking"] },
    { id: "sl-300", level: 300, areas: ["serverless"] },
  ];

  it("picks the first scenario at the highest open level of an area of interest", () => {
    const progress = player({
      unlocked: [...open("serverless", 100, 200), ...open("networking", 100, 200)],
    });
    expect(recommendedScenario(progress, scenarios)?.id).toBe("sl-200");
  });

  it("skips completed scenarios and falls back to a lower level", () => {
    const progress = player({
      unlocked: open("serverless", 100, 200),
      best: { "sl-200": best({ level: 200 }) },
    });
    expect(recommendedScenario(progress, scenarios)?.id).toBe("sl-100-a");
  });

  it("keeps the order of the listing on ties", () => {
    const progress = player({ unlocked: open("serverless", 100) });
    expect(recommendedScenario(progress, [...scenarios].reverse())?.id).toBe("sl-100-b");
  });

  it("ignores areas outside the interests and locked scenarios", () => {
    const progress = player({
      interests: ["networking"],
      unlocked: [...open("serverless", 100, 200, 300), ...open("networking", 100)],
    });
    // net-200 is locked for this player and nothing else is about networking.
    expect(recommendedScenario(progress, scenarios)).toBeNull();
  });

  it("prefers an area at its highest open level over a lower level left in another", () => {
    const progress = player({
      interests: ["serverless", "networking"],
      unlocked: [...open("serverless", 100, 200, 300), ...open("networking", 100, 200)],
      best: { "sl-300": best({ level: 300 }) },
    });
    // serverless has nothing left at 300; networking is at its highest level, 200.
    expect(recommendedScenario(progress, scenarios)?.id).toBe("net-200");
  });

  it("counts every area when the player has no interests", () => {
    const progress = player({ interests: [], unlocked: open("networking", 100, 200) });
    expect(recommendedScenario(progress, scenarios)?.id).toBe("net-200");
  });

  it("returns null when everything is completed", () => {
    const progress = createProgress(
      { experience: "expert", interests: ["serverless"] },
      scenarios,
      gameRules,
    );
    const done = Object.fromEntries(scenarios.map((s) => [s.id, best({ level: s.level })]));
    expect(recommendedScenario({ ...progress, best: done }, scenarios)).toBeNull();
  });
});

describe("lockReason", () => {
  const listed: ScenarioInfo[] = [
    { id: "n-100", level: 100, areas: ["networking"] },
    { id: "s-100", level: 100, areas: ["security"] },
    { id: "s-200", level: 200, areas: ["security"] },
    { id: "d-200", level: 200, areas: ["data"] },
  ];

  it("is null for a playable scenario", () => {
    expect(
      lockReason(open("networking", 100), { level: 100, areas: ["networking"] }, listed),
    ).toBeNull();
  });

  it("names the area of the scenario where the player is closest, and its open level", () => {
    const unlocked = [...open("networking", 100), ...open("security", 100, 200)];
    expect(lockReason(unlocked, { level: 300, areas: ["networking", "security"] }, listed)).toEqual(
      { level: 200, area: "security" },
    );
  });

  it("goes to the main area on ties", () => {
    const unlocked = [...open("networking", 100), ...open("security", 100)];
    expect(lockReason(unlocked, { level: 200, areas: ["networking", "security"] }, listed)).toEqual(
      { level: 100, area: "networking" },
    );
  });

  it("prefers, on ties, an area with scenarios at that level", () => {
    const unlocked = [...open("data", 100), ...open("security", 100)];
    expect(lockReason(unlocked, { level: 200, areas: ["data", "security"] }, listed)).toEqual({
      level: 100,
      area: "security",
    });
  });

  it("names no area when the area has no scenarios at that level: any area counts", () => {
    const unlocked = open("networking", 100, 200);
    expect(lockReason(unlocked, { level: 300, areas: ["networking"] }, listed)).toEqual({
      level: 200,
      area: null,
    });
  });

  it("falls back to the previous level of the main area when nothing is open below", () => {
    expect(lockReason([], { level: 300, areas: ["data", "ml"] }, listed)).toEqual({
      level: 200,
      area: "data",
    });
    expect(lockReason([], { level: 100, areas: [] }, listed)).toEqual({ level: 100, area: null });
  });
});
