// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The draft that the preview plays and the answers view shows (RF-STU-08, 09; ADR-0025 §2): the
// last Scenario of the editor that passed the schema, never the file on disk. While the text does
// not parse or fails the schema, the last valid one stays, along with the first error to point at.
import type { Scenario } from "@blueprint/scenario-schema";
import { useState } from "react";
import type { ScenarioValidation, StudioFinding } from "../../shared/validation";

export interface DraftState {
  /** The validation result this state was derived from. */
  readonly result: ScenarioValidation | undefined;
  /** The last valid scenario; the same object while its content does not change. */
  readonly scenario: Scenario | undefined;
}

export const EMPTY_DRAFT: DraftState = { result: undefined, scenario: undefined };

/** Same content: an edit of comments or blank lines is not a new version of the scenario. */
export const sameScenario = (a: Scenario, b: Scenario): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/** The state after a new validation result; the same object when nothing changed. */
export const nextDraft = (
  state: DraftState,
  result: ScenarioValidation | undefined,
): DraftState => {
  if (result === state.result) return state;
  const scenario = result?.scenario;
  if (scenario === undefined) return { result, scenario: state.scenario };
  if (state.scenario !== undefined && sameScenario(state.scenario, scenario)) {
    return { result, scenario: state.scenario };
  }
  return { result, scenario };
};

export interface Draft {
  scenario: Scenario | undefined;
  /** First error of a text that does not parse or fails the schema; the draft is the last valid. */
  problem: StudioFinding | undefined;
}

export const draftOf = ({ result, scenario }: DraftState): Draft => ({
  scenario,
  problem:
    result === undefined || result.scenario !== undefined
      ? undefined
      : result.findings.find((finding) => finding.severity === "error"),
});

export const useDraft = (result: ScenarioValidation | undefined): Draft => {
  const [state, setState] = useState(EMPTY_DRAFT);
  const next = nextDraft(state, result);
  // State derived from props, updated during render (no extra paint with the old draft).
  if (next !== state) setState(next);
  return draftOf(next);
};
