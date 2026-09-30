// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Slot points and scenario result (docs/01 "Reglas de puntaje", RF-EVAL-05). Every number
// comes from content/game-rules.yaml.
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import type { EvaluationGrade } from "./evaluate.js";
import { slotNodes, slotStatus, type SessionState, type SlotState } from "./session.js";

export type Level = Scenario["level"];

export interface SlotResult {
  readonly slotId: string;
  readonly serviceId: string | null;
  readonly grade: EvaluationGrade | null;
  readonly accepted: boolean;
  /** The player viewed the solution (RF-PLAY-14): `serviceId` is the optimal answer shown. */
  readonly revealed: boolean;
  readonly errors: number;
  readonly hintsUsed: number;
  /** Green with a single placement. */
  readonly firstTry: boolean;
  readonly points: number;
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly version: number;
  readonly level: Level;
  readonly areas: readonly string[];
  readonly completed: boolean;
  readonly score: number;
  /** `firstTryGreen` × slots. */
  readonly maxScore: number;
  readonly multiplier: number;
  /** `score × multiplier`, rounded to the nearest integer. */
  readonly xp: number;
  readonly hintsUsed: number;
  /** Slots whose solution the player viewed (RF-PLAY-14). */
  readonly solutionsViewed: number;
  /** Completed with every slot green at the first attempt. */
  readonly perfect: boolean;
  readonly slots: readonly SlotResult[];
}

/**
 * Points of one slot:
 * - green: `firstTryGreen` with no red placements, else `max(min, firstTryGreen − penaltyPerError·N)`;
 * - accepted orange: `acceptedAcceptable`;
 * - solution viewed (RF-PLAY-14): 0, fixed by the requirement rather than game-rules;
 * - anything else (unfinished): 0;
 * minus `hintCost` per hint, never below 0.
 */
export const slotPoints = (slot: SlotState, scoring: GameRules["scoring"]): number => {
  const status = slotStatus(slot);
  const base =
    status === "optimal"
      ? slot.errors === 0
        ? scoring.firstTryGreen
        : Math.max(
            scoring.greenAfterErrors.min,
            scoring.firstTryGreen - scoring.greenAfterErrors.penaltyPerError * slot.errors,
          )
      : status === "accepted"
        ? scoring.acceptedAcceptable
        : 0;
  return Math.max(0, base - scoring.hintCost * slot.hintsRevealed);
};

/**
 * Highest score the scenario allows: every slot green at the first attempt with no hints
 * (`firstTryGreen` × slots). Points never carry the level multiplier; XP does.
 */
export const scenarioMaxScore = (
  scenario: Pick<Scenario, "diagram">,
  rules: Pick<GameRules, "scoring">,
): number => rules.scoring.firstTryGreen * slotNodes(scenario).length;

export const levelMultiplier = (level: Level, rules: Pick<GameRules, "levelMultipliers">) =>
  rules.levelMultipliers[`${level}`];

/** XP of the scenario: Σ points × level multiplier, rounded only at the end. */
export const scenarioResult = (state: SessionState): ScenarioResult => {
  const { scenario, rules } = state;
  const slots = state.slots.map((slot): SlotResult => ({
    slotId: slot.slotId,
    serviceId: slot.placed,
    grade: slot.evaluation?.grade ?? null,
    accepted: slot.accepted,
    revealed: slot.revealed,
    errors: slot.errors,
    hintsUsed: slot.hintsRevealed,
    // A revealed slot is never "optimal" for slotStatus, so it is never a first-try green.
    firstTry: slotStatus(slot) === "optimal" && slot.placements === 1,
    points: slotPoints(slot, rules.scoring),
  }));
  const score = slots.reduce((sum, slot) => sum + slot.points, 0);
  const multiplier = levelMultiplier(scenario.level, rules);
  return {
    scenarioId: scenario.id,
    version: scenario.version,
    level: scenario.level,
    areas: scenario.areas,
    completed: state.completed,
    score,
    maxScore: scenarioMaxScore(scenario, rules),
    multiplier,
    xp: Math.round(score * multiplier),
    hintsUsed: slots.reduce((sum, slot) => sum + slot.hintsUsed, 0),
    solutionsViewed: slots.filter((slot) => slot.revealed).length,
    perfect: state.completed && slots.every((slot) => slot.firstTry),
    slots,
  };
};
