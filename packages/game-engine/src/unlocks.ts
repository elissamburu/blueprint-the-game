// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Level unlocks by (area, level) pair (RF-ONB-02, RF-NAV-03).
import { LEVELS, type Experience, type GameRules, type Scenario } from "@blueprint/scenario-schema";
import type { Level } from "./scoring.js";

/** What unlocks need to know about a playable scenario (published or beta). */
export type ScenarioInfo = Pick<Scenario, "id" | "level" | "areas">;

export interface LevelUnlock {
  readonly area: string;
  readonly level: Level;
}

/** A completed scenario, as the player progress remembers it. */
export interface CompletedScenario {
  readonly level: Level;
  readonly areas: readonly string[];
}

export interface UnlockInput {
  readonly experience: Experience;
  readonly unlocked: readonly LevelUnlock[];
  readonly completed: readonly CompletedScenario[];
}

/**
 * Every (area, level) pair open for the player. The result contains `unlocked` (unlocks are
 * permanent) plus:
 * - the levels of `unlock.byExperience[experience]` in every area of `scenarios`;
 * - (area, N+1) when (area, N) is open and the player completed at least
 *   `min(scenariosRequired, scenarios of that area at level N)` scenarios of that area at
 *   level N. A completed scenario counts for each of its areas; with 0 scenarios the
 *   requirement is met, so the chain goes on.
 * Sorted by area and level.
 */
export const computeUnlocks = (
  input: UnlockInput,
  scenarios: readonly ScenarioInfo[],
  rules: Pick<GameRules, "unlock">,
): LevelUnlock[] => {
  const areas = new Set([
    ...scenarios.flatMap((s) => s.areas),
    ...input.unlocked.map((u) => u.area),
  ]);
  const initial = rules.unlock.byExperience[input.experience];
  const countIn = (items: readonly CompletedScenario[], area: string, level: Level) =>
    items.filter((item) => item.level === level && item.areas.includes(area)).length;

  return [...areas].sort().flatMap((area) => {
    const open = new Set<Level>([
      ...initial,
      ...input.unlocked.filter((u) => u.area === area).map((u) => u.level),
    ]);
    LEVELS.forEach((level, i) => {
      const next = LEVELS[i + 1];
      if (next === undefined || !open.has(level) || open.has(next)) return;
      const required = Math.min(rules.unlock.scenariosRequired, countIn(scenarios, area, level));
      if (countIn(input.completed, area, level) >= required) open.add(next);
    });
    return LEVELS.filter((level) => open.has(level)).map((level) => ({ area, level }));
  });
};

export const isLevelUnlocked = (
  unlocked: readonly LevelUnlock[],
  area: string,
  level: Level,
): boolean => unlocked.some((u) => u.area === area && u.level === level);

/** A scenario is playable when its level is open in at least one of its areas. */
export const isScenarioPlayable = (
  unlocked: readonly LevelUnlock[],
  scenario: Pick<Scenario, "level" | "areas">,
): boolean => scenario.areas.some((area) => isLevelUnlocked(unlocked, area, scenario.level));
