// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Player progress without persistence (RF-GAM-01, RF-GAM-10, RF-PLAY-10). XP and ranks are
// global; XP is never lost: replaying only adds the improvement over the best result.
import type { Experience, GameRules } from "@blueprint/scenario-schema";
import type { Level, ScenarioResult } from "./scoring.js";
import { computeUnlocks, type LevelUnlock, type ScenarioInfo } from "./unlocks.js";

export type Rank = GameRules["ranks"][number];

/** Best completed result of a scenario. */
export interface BestResult {
  readonly version: number;
  readonly level: Level;
  readonly areas: readonly string[];
  readonly score: number;
  readonly maxScore: number;
  readonly xp: number;
  readonly hintsUsed: number;
  readonly perfect: boolean;
}

export interface PlayerProgress {
  readonly experience: Experience;
  /** Accumulated XP: the sum of the XP of every best result. */
  readonly xp: number;
  /** Best completed result by scenario id. */
  readonly best: Readonly<Record<string, BestResult>>;
  /** Open (area, level) pairs; the set only grows. */
  readonly unlocked: readonly LevelUnlock[];
}

/** Events for the in-app toasts of RF-GAM-10. */
export type ProgressEvent =
  | { type: "xpGained"; amount: number; total: number }
  | { type: "rankUp"; from: Rank; to: Rank }
  | { type: "levelUnlocked"; level: Level; areas: readonly string[] };

export interface ProgressUpdate {
  readonly progress: PlayerProgress;
  readonly events: readonly ProgressEvent[];
}

/** Highest rank whose `minXp` the player reached (the lowest one if none). */
export const rankForXp = (xp: number, rules: Pick<GameRules, "ranks">): Rank => {
  const sorted = [...rules.ranks].sort((a, b) => a.minXp - b.minXp);
  const lowest = sorted[0];
  if (lowest === undefined) throw new Error("game-rules.yaml no define rangos");
  return sorted.reduce((current, rank) => (rank.minXp <= xp ? rank : current), lowest);
};

const completedOf = (progress: Pick<PlayerProgress, "best">) => Object.values(progress.best);

/** Progress of a new player: the levels of their experience (RF-ONB-02), in every area. */
export const createProgress = (
  experience: Experience,
  scenarios: readonly ScenarioInfo[],
  rules: Pick<GameRules, "unlock">,
): PlayerProgress => ({
  experience,
  xp: 0,
  best: {},
  unlocked: computeUnlocks({ experience, unlocked: [], completed: [] }, scenarios, rules),
});

/**
 * Recomputes the open pairs against the current scenarios (e.g. after loading new content
 * with a new area). Idempotent; emits `levelUnlocked` for the new pairs.
 */
export const refreshUnlocks = (
  progress: PlayerProgress,
  scenarios: readonly ScenarioInfo[],
  rules: Pick<GameRules, "unlock">,
): ProgressUpdate => {
  const unlocked = computeUnlocks(
    {
      experience: progress.experience,
      unlocked: progress.unlocked,
      completed: completedOf(progress),
    },
    scenarios,
    rules,
  );
  return { progress: { ...progress, unlocked }, events: unlockEvents(progress.unlocked, unlocked) };
};

/**
 * Applies a scenario result. An unfinished result changes nothing. A completed one replaces
 * the best result of the scenario when it has more XP, and adds only that improvement.
 * Events come in toast order: `xpGained`, `rankUp`, then one `levelUnlocked` per level.
 */
export const applyScenarioResult = (
  progress: PlayerProgress,
  result: ScenarioResult,
  rules: Pick<GameRules, "ranks" | "unlock">,
  scenarios: readonly ScenarioInfo[],
): ProgressUpdate => {
  if (!result.completed) return { progress, events: [] };

  const previous = progress.best[result.scenarioId];
  const gained = Math.max(0, result.xp - (previous?.xp ?? 0));
  const best: Record<string, BestResult> =
    previous !== undefined && previous.xp >= result.xp
      ? { ...progress.best }
      : {
          ...progress.best,
          [result.scenarioId]: {
            version: result.version,
            level: result.level,
            areas: result.areas,
            score: result.score,
            maxScore: result.maxScore,
            xp: result.xp,
            hintsUsed: result.hintsUsed,
            perfect: result.perfect,
          },
        };
  const xp = progress.xp + gained;
  const refreshed = refreshUnlocks({ ...progress, xp, best }, scenarios, rules);

  const events: ProgressEvent[] = [];
  if (gained > 0) events.push({ type: "xpGained", amount: gained, total: xp });
  const from = rankForXp(progress.xp, rules);
  const to = rankForXp(xp, rules);
  if (from.id !== to.id) events.push({ type: "rankUp", from, to });
  return { progress: refreshed.progress, events: [...events, ...refreshed.events] };
};

const unlockEvents = (
  before: readonly LevelUnlock[],
  after: readonly LevelUnlock[],
): ProgressEvent[] => {
  const known = new Set(before.map((u) => `${u.area}@${u.level}`));
  const added = after.filter((u) => !known.has(`${u.area}@${u.level}`));
  const levels = [...new Set(added.map((u) => u.level))].sort((a, b) => a - b);
  return levels.map((level) => ({
    type: "levelUnlocked",
    level,
    areas: added.filter((u) => u.level === level).map((u) => u.area),
  }));
};
