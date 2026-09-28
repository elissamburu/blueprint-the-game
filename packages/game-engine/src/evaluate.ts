// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Grade of a service placed in a slot (docs/03 §2 "Semántica de la evaluación", ADR-0007).
import type { Grade, SlotNode } from "@blueprint/scenario-schema";

/** Grade shown to the player: green (`optimal`), orange (`acceptable`) or red (`incorrect`). */
export type EvaluationGrade = Grade | "incorrect";

/**
 * Result of placing a service. Texts and objective ids come verbatim from the scenario.
 * - `answer`: the service is in `answers`; `objectives` are the ones that justify the grade.
 * - `incorrect`: the service is in `incorrect`; `violates` are the objectives it breaks
 *   (empty when the entry declares none).
 * - `undeclared`: the service is in neither list. The scenario has no text for it, so the UI
 *   composes the generic explanation (catalog `short` + `role`, docs/03 §2) from these data.
 */
export type Evaluation =
  | {
      source: "answer";
      grade: Grade;
      serviceId: string;
      rationale: string;
      objectives: readonly string[];
      references: readonly string[];
    }
  | {
      source: "incorrect";
      grade: "incorrect";
      serviceId: string;
      rationale: string;
      violates: readonly string[];
    }
  | {
      source: "undeclared";
      grade: "incorrect";
      serviceId: string;
      role: string;
    };

export const evaluatePlacement = (
  slot: Pick<SlotNode, "role" | "answers" | "incorrect">,
  serviceId: string,
): Evaluation => {
  const answer = slot.answers.find((a) => a.service === serviceId);
  if (answer !== undefined) {
    return {
      source: "answer",
      grade: answer.grade,
      serviceId,
      rationale: answer.rationale,
      objectives: answer.objectives,
      references: answer.references,
    };
  }
  const incorrect = slot.incorrect.find((i) => i.service === serviceId);
  if (incorrect !== undefined) {
    return {
      source: "incorrect",
      grade: "incorrect",
      serviceId,
      rationale: incorrect.rationale,
      violates: incorrect.violates ?? [],
    };
  }
  return { source: "undeclared", grade: "incorrect", serviceId, role: slot.role };
};
