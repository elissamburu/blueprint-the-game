// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Slot by slot review of the summary screen (RF-PLAY-09): what the player chose and with which
// result, the hints they used, and the optimal answers with their explanation and references.
import type { Scenario } from "@blueprint/scenario-schema";
import type { SlotResult } from "./scoring.js";
import { slotNodes, type SlotStatus } from "./session.js";

export interface ReviewAnswer {
  readonly serviceId: string;
  readonly rationale: string;
  /** Official documentation of the answer (https URLs from the scenario). */
  readonly references: readonly string[];
}

export interface SlotReview {
  /** 1-based position of the slot in diagram order: the number `slotNumbers` gives it. */
  readonly number: number;
  readonly slotId: string;
  readonly role: string;
  /** Service the player left in the slot, or null when it ended empty. */
  readonly chosen: string | null;
  readonly status: SlotStatus;
  readonly hintsUsed: number;
  readonly errors: number;
  readonly points: number;
  /** Every optimal answer of the slot, in scenario order. */
  readonly optimal: readonly ReviewAnswer[];
}

/** Status of a slot result, with the meaning of `slotStatus`. */
export const slotResultStatus = (
  slot: Pick<SlotResult, "grade" | "accepted" | "revealed">,
): SlotStatus => {
  if (slot.revealed) return "revealed";
  if (slot.grade === null) return "empty";
  if (slot.grade === "acceptable" && slot.accepted) return "accepted";
  return slot.grade;
};

/**
 * One entry per slot of the scenario, in diagram order. A slot without a result (e.g. the
 * result is of another version of the scenario) is reviewed as empty.
 */
export const scenarioReview = (
  scenario: Pick<Scenario, "diagram">,
  results: readonly SlotResult[],
): SlotReview[] => {
  const byId = new Map(results.map((r) => [r.slotId, r]));
  return slotNodes(scenario).map((node, index): SlotReview => {
    const result = byId.get(node.id);
    return {
      number: index + 1,
      slotId: node.id,
      role: node.role,
      chosen: result?.serviceId ?? null,
      status: result === undefined ? "empty" : slotResultStatus(result),
      hintsUsed: result?.hintsUsed ?? 0,
      errors: result?.errors ?? 0,
      points: result?.points ?? 0,
      optimal: node.answers
        .filter((answer) => answer.grade === "optimal")
        .map((answer) => ({
          serviceId: answer.service,
          rationale: answer.rationale,
          references: answer.references,
        })),
    };
  });
};

/**
 * Slots of the review by status, for the summary header ("5 óptimos · 2 aceptables · 1 solución
 * vista").
 */
export const reviewCounts = (review: readonly Pick<SlotReview, "status">[]) => {
  const counts: Record<SlotStatus, number> = {
    optimal: 0,
    accepted: 0,
    acceptable: 0,
    incorrect: 0,
    empty: 0,
    revealed: 0,
  };
  for (const item of review) counts[item.status] += 1;
  return counts;
};
