// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the scenario listing shows about the player (RF-NAV-01, RF-NAV-02, RF-NAV-04): the
// status of each scenario, the recommended one and why a scenario is locked. They depend on the
// unlock rules and on the progress, so they live here and the UI only renders them.
import { LEVELS } from "@blueprint/scenario-schema";
import type { PlayerProgress } from "./progress.js";
import type { Level } from "./scoring.js";
import {
  isLevelUnlocked,
  isScenarioPlayable,
  type LevelUnlock,
  type ScenarioInfo,
} from "./unlocks.js";

/** Status filter of the listing (RF-NAV-01). */
export const SCENARIO_STATUSES = [
  "new",
  "in-progress",
  "completed-green",
  "completed-orange",
] as const;

export type ScenarioStatus = (typeof SCENARIO_STATUSES)[number];

/**
 * Status of a scenario for the player:
 * - completed, green or with oranges, after the best result (it wins over "in progress");
 * - `in-progress` when it was started and never completed;
 * - `new` otherwise.
 */
export const scenarioStatus = (
  progress: Pick<PlayerProgress, "best" | "started">,
  scenarioId: string,
): ScenarioStatus => {
  const best = progress.best[scenarioId];
  if (best !== undefined) return best.allOptimal ? "completed-green" : "completed-orange";
  return progress.started.includes(scenarioId) ? "in-progress" : "new";
};

/** Highest open level of an area, or null when none is open. */
const highestOpenLevel = (unlocked: readonly LevelUnlock[], area: string): Level | null =>
  LEVELS.reduce<Level | null>(
    (highest, level) => (isLevelUnlocked(unlocked, area, level) ? level : highest),
    null,
  );

/**
 * The recommended scenario (RF-NAV-02), or null when there is none: the first playable,
 * uncompleted scenario of an area of interest, at the highest level the player has open in
 * that area. When no such scenario is left at that level, the next highest level wins. Ties keep
 * the order of `scenarios` (the listing order). A player without interests (a progress stored
 * before they existed) is treated as interested in every area.
 */
export const recommendedScenario = <T extends ScenarioInfo>(
  progress: Pick<PlayerProgress, "best" | "unlocked" | "interests">,
  scenarios: readonly T[],
): T | null => {
  const interested = (area: string) =>
    progress.interests.length === 0 || progress.interests.includes(area);
  const ranked = scenarios.flatMap((scenario, index) => {
    if (progress.best[scenario.id] !== undefined) return [];
    const areas = scenario.areas.filter(
      (area) => interested(area) && isLevelUnlocked(progress.unlocked, area, scenario.level),
    );
    if (areas.length === 0) return [];
    const atHighest = areas.some(
      (area) => highestOpenLevel(progress.unlocked, area) === scenario.level,
    );
    return [{ scenario, index, atHighest }];
  });
  ranked.sort(
    (a, b) =>
      Number(b.atHighest) - Number(a.atHighest) ||
      b.scenario.level - a.scenario.level ||
      a.index - b.index,
  );
  return ranked[0]?.scenario ?? null;
};

/**
 * Why a scenario is locked: complete scenarios of `level` in `area`, or of any area when `area`
 * is null (the area has no scenarios at that level, so any area counts: RF-NAV-03).
 */
export interface LockReason {
  readonly level: Level;
  readonly area: string | null;
}

/**
 * Null when the scenario is playable. Otherwise, the next step toward it: the area of the
 * scenario where the player is closest (the highest open level below the scenario's) and that
 * level. On ties, an area with listed scenarios at that level wins, then the first one (the main
 * area). With nothing open below it in any of its areas, the previous level in the main area.
 * When the chosen area has no listed scenarios at that level, the reason names no area.
 */
export const lockReason = (
  unlocked: readonly LevelUnlock[],
  scenario: Pick<ScenarioInfo, "level" | "areas">,
  scenarios: readonly ScenarioInfo[],
): LockReason | null => {
  if (isScenarioPlayable(unlocked, scenario)) return null;
  const hasScenarios = (area: string, level: Level) =>
    scenarios.some((s) => s.level === level && s.areas.includes(area));
  const candidates = scenario.areas.flatMap((area, index) => {
    const level = LEVELS.filter((l) => l < scenario.level && isLevelUnlocked(unlocked, area, l)).at(
      -1,
    );
    return level === undefined ? [] : [{ area, level, index, listed: hasScenarios(area, level) }];
  });
  candidates.sort(
    (a, b) => b.level - a.level || Number(b.listed) - Number(a.listed) || a.index - b.index,
  );
  const step = candidates[0] ?? {
    level: LEVELS[Math.max(0, LEVELS.indexOf(scenario.level) - 1)] ?? scenario.level,
    area: scenario.areas[0] ?? "",
  };
  return { level: step.level, area: hasScenarios(step.area, step.level) ? step.area : null };
};
