// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Finalizar" (RF-PLAY-08, RF-GAM-10): the result and the progress update come from game-engine;
// this only saves the progress and turns the engine events into toast texts.
import {
  applyScenarioResult,
  scenarioResult,
  type PlayerProgress,
  type ProgressEvent,
  type ScenarioInfo,
  type ScenarioResult,
  type SessionState,
} from "@blueprint/game-engine";
import type { Area, GameRules } from "@blueprint/scenario-schema";
import type { TFunction } from "i18next";
import * as z from "zod";

export interface FinishInput {
  readonly session: SessionState;
  /** null before onboarding: the game is played, but the result is not kept. */
  readonly progress: PlayerProgress | null;
  readonly rules: GameRules;
  readonly scenarios: readonly ScenarioInfo[];
  readonly save: (progress: PlayerProgress) => Promise<void>;
}

export interface FinishOutcome {
  readonly result: ScenarioResult;
  readonly saved: boolean;
  /** XP added to the player's total (0 when not saved or not an improvement). */
  readonly xpGained: number;
  readonly events: readonly ProgressEvent[];
}

export const finishScenario = async (input: FinishInput): Promise<FinishOutcome> => {
  const result = scenarioResult(input.session);
  if (input.progress === null) return { result, saved: false, xpGained: 0, events: [] };
  const update = applyScenarioResult(input.progress, result, input.rules, input.scenarios);
  await input.save(update.progress);
  const xpGained = update.events.reduce(
    (sum, event) => (event.type === "xpGained" ? sum + event.amount : sum),
    0,
  );
  return { result, saved: true, xpGained, events: update.events };
};

/** Toast text of a progress event (RF-GAM-10). */
export const progressEventText = (
  t: TFunction,
  event: ProgressEvent,
  areas: readonly Pick<Area, "id" | "name">[],
): string => {
  switch (event.type) {
    case "xpGained":
      return t("play.finish.xpGained", { amount: event.amount, total: event.total });
    case "rankUp":
      return t("play.finish.rankUp", { rank: event.to.name });
    case "levelUnlocked": {
      const names = event.areas.map((id) => areas.find((a) => a.id === id)?.name ?? id);
      return t("play.finish.levelUnlocked", {
        level: event.level,
        areas: new Intl.ListFormat("es", { type: "conjunction" }).format(names),
      });
    }
  }
};

/** What the summary route receives through the navigation state. */
export const SummaryStateSchema = z.object({
  score: z.number().int().nonnegative(),
  maxScore: z.number().int().nonnegative(),
  xp: z.number().int().nonnegative(),
  xpGained: z.number().int().nonnegative(),
  saved: z.boolean(),
});

export type SummaryState = z.infer<typeof SummaryStateSchema>;

export const summaryState = (outcome: FinishOutcome): SummaryState => ({
  score: outcome.result.score,
  maxScore: outcome.result.maxScore,
  xp: outcome.result.xp,
  xpGained: outcome.xpGained,
  saved: outcome.saved,
});
