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
  /** Every slot ended green: no accepted orange (RF-NAV-01, "completado en verde"). */
  readonly allOptimal: boolean;
}

export interface PlayerProgress {
  readonly experience: Experience;
  /** Areas of interest chosen in the onboarding (RF-ONB-01), ids of content/areas.yaml. */
  readonly interests: readonly string[];
  /** Accumulated XP: the sum of the XP of every best result. */
  readonly xp: number;
  /** Best completed result by scenario id. */
  readonly best: Readonly<Record<string, BestResult>>;
  /** Open (area, level) pairs; the set only grows. */
  readonly unlocked: readonly LevelUnlock[];
  /** Ids of the scenarios where the player placed at least one service; the set only grows. */
  readonly started: readonly string[];
}

/** What the player answers in the onboarding (RF-ONB-01, RF-ONB-02). */
export interface OnboardingChoices {
  readonly experience: Experience;
  readonly interests: readonly string[];
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

/**
 * Progress of a new player: their areas of interest (without repeats) and the levels of their
 * experience (RF-ONB-02), open in every area.
 */
export const createProgress = (
  { experience, interests }: OnboardingChoices,
  scenarios: readonly ScenarioInfo[],
  rules: Pick<GameRules, "unlock">,
): PlayerProgress => ({
  experience,
  interests: [...new Set(interests)],
  xp: 0,
  best: {},
  unlocked: computeUnlocks({ experience, unlocked: [], completed: [] }, scenarios, rules),
  started: [],
});

/**
 * Remembers that the player started a scenario ("en curso" in the listing until it is
 * completed). Returns the same object when it was already started.
 */
export const markScenarioStarted = (
  progress: PlayerProgress,
  scenarioId: string,
): PlayerProgress =>
  progress.started.includes(scenarioId)
    ? progress
    : { ...progress, started: [...progress.started, scenarioId] };

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
 * How a completed result compares with the best one already kept for the scenario (RF-PLAY-10):
 * - `first`: no previous best; all its XP counts.
 * - `improved`: more XP than the best; only the difference counts.
 * - `equal` / `lower`: the best stays and no XP is added.
 */
export type BestComparison =
  | { readonly kind: "first"; readonly gained: number }
  | { readonly kind: "improved"; readonly gained: number; readonly previousXp: number }
  | { readonly kind: "equal" | "lower"; readonly gained: 0; readonly previousXp: number };

export const compareWithBest = (
  progress: Pick<PlayerProgress, "best">,
  result: Pick<ScenarioResult, "scenarioId" | "xp">,
): BestComparison => {
  const previous = progress.best[result.scenarioId];
  if (previous === undefined) return { kind: "first", gained: result.xp };
  if (result.xp > previous.xp) {
    return { kind: "improved", gained: result.xp - previous.xp, previousXp: previous.xp };
  }
  return {
    kind: result.xp === previous.xp ? "equal" : "lower",
    gained: 0,
    previousXp: previous.xp,
  };
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

  const comparison = compareWithBest(progress, result);
  const gained = comparison.gained;
  const best: Record<string, BestResult> =
    comparison.kind === "equal" || comparison.kind === "lower"
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
            allOptimal: result.slots.every((slot) => slot.grade === "optimal"),
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

/** Where the player stands between their rank and the next one (RF-GAM-01). */
export interface RankProgress {
  readonly rank: Rank;
  /** null at the highest rank. */
  readonly next: Rank | null;
  readonly xp: number;
  /** XP still missing for `next` (0 at the highest rank). */
  readonly remaining: number;
  /** Share of the way from `rank.minXp` to `next.minXp`, 0–100, rounded down (100 at the top). */
  readonly percent: number;
}

export const rankProgress = (xp: number, rules: Pick<GameRules, "ranks">): RankProgress => {
  const rank = rankForXp(xp, rules);
  const next =
    [...rules.ranks].sort((a, b) => a.minXp - b.minXp).find((r) => r.minXp > rank.minXp) ?? null;
  if (next === null) return { rank, next, xp, remaining: 0, percent: 100 };
  const span = next.minXp - rank.minXp;
  return {
    rank,
    next,
    xp,
    remaining: next.minXp - xp,
    percent: Math.floor(((xp - rank.minXp) / span) * 100),
  };
};

/**
 * Changes the areas of interest and the experience from the profile (RF-ONB-03). Unlocks are
 * permanent (CA RF-NAV-03): a higher experience opens its levels in every area, a lower one
 * closes nothing. Emits `levelUnlocked` for the new pairs.
 */
export const updatePreferences = (
  progress: PlayerProgress,
  { experience, interests }: OnboardingChoices,
  scenarios: readonly ScenarioInfo[],
  rules: Pick<GameRules, "unlock">,
): ProgressUpdate =>
  refreshUnlocks({ ...progress, experience, interests: [...new Set(interests)] }, scenarios, rules);

/** Open levels of each area, in the order of `areas` (areas with none are left out). */
export const unlockedLevelsByArea = (
  unlocked: readonly LevelUnlock[],
  areas: readonly string[],
): { readonly area: string; readonly levels: readonly Level[] }[] =>
  [...new Set([...areas, ...unlocked.map((u) => u.area)])].flatMap((area) => {
    const levels = unlocked
      .filter((u) => u.area === area)
      .map((u) => u.level)
      .sort((a, b) => a - b);
    return levels.length === 0 ? [] : [{ area, levels: [...new Set(levels)] }];
  });
