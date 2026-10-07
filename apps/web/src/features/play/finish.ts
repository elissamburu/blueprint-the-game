// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Finalizar" (RF-PLAY-08, RF-GAM-10): the result and the progress update come from game-engine;
// this only saves the progress and hands the summary what to show, events included.
import {
  applyScenarioResult,
  compareWithBest,
  scenarioResult,
  type BestComparison,
  type PlayerProgress,
  type ProgressEvent,
  type ScenarioInfo,
  type ScenarioResult,
  type SessionState,
} from "@blueprint/game-engine";
import { LEVELS, type Area, type GameRules } from "@blueprint/scenario-schema";
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
  /** How the result compares with the stored best (null when not saved). */
  readonly comparison: BestComparison | null;
  readonly events: readonly ProgressEvent[];
}

export const finishScenario = async (input: FinishInput): Promise<FinishOutcome> => {
  const result = scenarioResult(input.session);
  if (input.progress === null) return { result, saved: false, comparison: null, events: [] };
  const comparison = compareWithBest(input.progress, result);
  const update = applyScenarioResult(input.progress, result, input.rules, input.scenarios);
  await input.save(update.progress);
  return { result, saved: true, comparison, events: update.events };
};

/** Text of a progress event, for the summary and the toasts (RF-GAM-10). */
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
    case "levelUnlocked":
      return t("play.finish.levelUnlocked", {
        level: event.level,
        areas: areaList(event.areas, areas),
      });
  }
};

/** "Serverless, Datos y Redes", with the names of areas.yaml. */
export const areaList = (ids: readonly string[], areas: readonly Pick<Area, "id" | "name">[]) =>
  new Intl.ListFormat("es", { type: "conjunction" }).format(
    ids.map((id) => areas.find((a) => a.id === id)?.name ?? id),
  );

const count = z.number().int().nonnegative();
const RankSchema = z.object({ id: z.string(), name: z.string(), minXp: count });
const LevelSchema = z.literal(LEVELS);

const ProgressEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("xpGained"), amount: count, total: count }),
  z.object({ type: z.literal("rankUp"), from: RankSchema, to: RankSchema }),
  z.object({
    type: z.literal("levelUnlocked"),
    level: LevelSchema,
    areas: z.array(z.string()).readonly(),
  }),
]);

const BestComparisonSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("first"), gained: count }),
  z.object({ kind: z.literal("improved"), gained: count, previousXp: count }),
  z.object({ kind: z.enum(["equal", "lower"]), gained: z.literal(0), previousXp: count }),
]);

const SlotResultSchema = z.object({
  slotId: z.string(),
  serviceId: z.string().nullable(),
  grade: z.enum(["optimal", "acceptable", "incorrect"]).nullable(),
  accepted: z.boolean(),
  // A summary opened from a navigation state saved before RF-PLAY-14 has no viewed solutions.
  revealed: z.boolean().default(false),
  errors: count,
  hintsUsed: count,
  firstTry: z.boolean(),
  points: count,
});

/**
 * What the summary route receives through the navigation state (it survives a reload of the
 * page, not a new visit). Everything is computed by game-engine at "Finalizar".
 */
export const SummaryStateSchema = z.object({
  version: z.number().int().positive(),
  level: LevelSchema,
  score: count,
  maxScore: count,
  multiplier: z.number().positive(),
  xp: count,
  saved: z.boolean(),
  comparison: BestComparisonSchema.nullable(),
  events: z.array(ProgressEventSchema),
  slots: z.array(SlotResultSchema),
});

export type SummaryState = z.infer<typeof SummaryStateSchema>;

export const summaryState = ({
  result,
  saved,
  comparison,
  events,
}: FinishOutcome): SummaryState => ({
  version: result.version,
  level: result.level,
  score: result.score,
  maxScore: result.maxScore,
  multiplier: result.multiplier,
  xp: result.xp,
  saved,
  comparison,
  events: [...events],
  slots: [...result.slots],
});
