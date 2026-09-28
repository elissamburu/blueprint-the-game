// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { gameRules } from "./testing/fixtures.js";
import {
  computeUnlocks,
  isLevelUnlocked,
  isScenarioPlayable,
  type CompletedScenario,
  type LevelUnlock,
  type ScenarioInfo,
} from "./unlocks.js";

const info = (id: string, level: ScenarioInfo["level"], areas: string[]): ScenarioInfo => ({
  id,
  level,
  areas,
});
const done = (level: CompletedScenario["level"], areas: string[]): CompletedScenario => ({
  level,
  areas,
});
const levelsOf = (unlocked: readonly LevelUnlock[], area: string) =>
  unlocked.filter((u) => u.area === area).map((u) => u.level);

/** Three scenarios per level in "serverless" and "data", so the default requirement (3) holds. */
const full = (["serverless", "data"] as const).flatMap((area) =>
  ([100, 200, 300, 400] as const).flatMap((level) =>
    [1, 2, 3].map((n) => info(`${area}-${level}-${n}`, level, [area])),
  ),
);

describe("computeUnlocks", () => {
  it("opens the experience levels in every area (RF-ONB-02)", () => {
    const unlocked = computeUnlocks(
      { experience: "aws-user", unlocked: [], completed: [] },
      full,
      gameRules,
    );
    expect(unlocked).toEqual([
      { area: "data", level: 100 },
      { area: "data", level: 200 },
      { area: "serverless", level: 100 },
      { area: "serverless", level: 200 },
    ]);
  });

  it("opens (area, N+1) after scenariosRequired completions of that area at level N", () => {
    const base = { experience: "beginner" as const, unlocked: [] };
    const two = computeUnlocks(
      { ...base, completed: [done(100, ["serverless"]), done(100, ["serverless"])] },
      full,
      gameRules,
    );
    expect(levelsOf(two, "serverless")).toEqual([100]);

    const three = computeUnlocks(
      {
        ...base,
        completed: [
          done(100, ["serverless"]),
          done(100, ["serverless"]),
          done(100, ["serverless"]),
        ],
      },
      full,
      gameRules,
    );
    expect(levelsOf(three, "serverless")).toEqual([100, 200]);
    expect(levelsOf(three, "data")).toEqual([100]);
  });

  it("counts a multi-area scenario for each of its areas", () => {
    const scenarios = [
      info("multi", 100, ["serverless", "data"]),
      info("s-200", 200, ["serverless"]),
      info("d-200", 200, ["data"]),
      info("x-300", 300, ["serverless", "data"]),
    ];
    const unlocked = computeUnlocks(
      { experience: "beginner", unlocked: [], completed: [done(100, ["serverless", "data"])] },
      scenarios,
      gameRules,
    );
    expect(levelsOf(unlocked, "serverless")).toEqual([100, 200]);
    expect(levelsOf(unlocked, "data")).toEqual([100, 200]);
  });

  it("requires min(scenariosRequired, scenarios of the area at level N)", () => {
    const scenarios = [info("a", 100, ["serverless"]), info("b", 200, ["serverless"])];
    const unlocked = computeUnlocks(
      { experience: "beginner", unlocked: [], completed: [done(100, ["serverless"])] },
      scenarios,
      gameRules,
    );
    expect(levelsOf(unlocked, "serverless")).toEqual([100, 200]);
  });

  it("uses the level-N scenarios of any area when the area has none at N", () => {
    const scenarios = [
      info("d-100-1", 100, ["data"]),
      info("d-100-2", 100, ["data"]),
      info("s-200", 200, ["serverless"]),
    ];
    const at = (completed: CompletedScenario[]) =>
      computeUnlocks({ experience: "beginner", unlocked: [], completed }, scenarios, gameRules);

    // "serverless" has no level-100 scenarios: it needs min(3, 2) = 2 of level 100 of any area.
    expect(levelsOf(at([]), "serverless")).toEqual([100]);
    const one = at([done(100, ["data"])]);
    expect(levelsOf(one, "serverless")).toEqual([100]);
    expect(levelsOf(one, "data")).toEqual([100]);

    const two = at([done(100, ["data"]), done(100, ["data"])]);
    expect(levelsOf(two, "serverless")).toEqual([100, 200]);
    // "data" has no level-200 scenarios: it waits for "s-200", the only one of level 200.
    expect(levelsOf(two, "data")).toEqual([100, 200]);
    expect(
      levelsOf(at([done(100, ["data"]), done(100, ["data"]), done(200, ["serverless"])]), "data"),
    ).toEqual([100, 200, 300]);
  });

  it("never opens N+1 when no area has scenarios of level N (a requirement of 0 is not met)", () => {
    const scenarios = [info("d-100", 100, ["data"]), info("d-300", 300, ["data"])];
    const fresh = computeUnlocks(
      { experience: "beginner", unlocked: [], completed: [] },
      scenarios,
      gameRules,
    );
    expect(levelsOf(fresh, "data")).toEqual([100]);

    const after = computeUnlocks(
      { experience: "beginner", unlocked: [], completed: [done(100, ["data"])] },
      scenarios,
      gameRules,
    );
    expect(levelsOf(after, "data")).toEqual([100, 200]);
    expect(
      levelsOf(
        computeUnlocks(
          { experience: "expert", unlocked: [], completed: [] },
          [info("d-300", 300, ["data"])],
          gameRules,
        ),
        "data",
      ),
    ).toEqual([100, 200, 300, 400]);
  });

  it("keeps (area, N+1) open when level N later grows from 1 to 3 scenarios", () => {
    const completed = [done(100, ["serverless"])];
    const before = [info("s-100-1", 100, ["serverless"]), info("s-200", 200, ["serverless"])];
    const unlocked = computeUnlocks(
      { experience: "beginner", unlocked: [], completed },
      before,
      gameRules,
    );
    expect(levelsOf(unlocked, "serverless")).toEqual([100, 200]);

    const grown = [
      ...before,
      info("s-100-2", 100, ["serverless"]),
      info("s-100-3", 100, ["serverless"]),
    ];
    // A new player with the same completions would need 3 now...
    expect(
      levelsOf(
        computeUnlocks({ experience: "beginner", unlocked: [], completed }, grown, gameRules),
        "serverless",
      ),
    ).toEqual([100]);
    // ...but an open pair is never closed.
    expect(
      levelsOf(
        computeUnlocks({ experience: "beginner", unlocked, completed }, grown, gameRules),
        "serverless",
      ),
    ).toEqual([100, 200]);
  });

  it("does not open N+1 from completions of a level that is not open in that area", () => {
    const unlocked = computeUnlocks(
      {
        experience: "beginner",
        unlocked: [],
        completed: [
          done(200, ["serverless"]),
          done(200, ["serverless"]),
          done(200, ["serverless"]),
        ],
      },
      full,
      gameRules,
    );
    expect(levelsOf(unlocked, "serverless")).toEqual([100]);
  });

  it("keeps stored pairs of areas without scenarios", () => {
    const unlocked = computeUnlocks(
      { experience: "beginner", unlocked: [{ area: "legacy", level: 200 }], completed: [] },
      [],
      gameRules,
    );
    expect(unlocked).toContainEqual({ area: "legacy", level: 200 });
  });
});

describe("isScenarioPlayable", () => {
  const unlocked: LevelUnlock[] = [
    { area: "serverless", level: 100 },
    { area: "serverless", level: 200 },
    { area: "data", level: 100 },
  ];

  it("is playable when its level is open in at least one of its areas", () => {
    expect(isLevelUnlocked(unlocked, "serverless", 200)).toBe(true);
    expect(isLevelUnlocked(unlocked, "data", 200)).toBe(false);
    expect(isScenarioPlayable(unlocked, { level: 200, areas: ["data", "serverless"] })).toBe(true);
    expect(isScenarioPlayable(unlocked, { level: 200, areas: ["data"] })).toBe(false);
    expect(isScenarioPlayable(unlocked, { level: 300, areas: ["serverless"] })).toBe(false);
  });
});
