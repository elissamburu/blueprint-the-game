// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Live validation (RF-STU-07): scenario-schema and content-lint in the browser, 250 ms after the
// last change.
import { useEffect, useState } from "react";
import type { SharedContent } from "../../shared/api";
import { validateScenarioText, type ScenarioValidation } from "../../shared/validation";

export const VALIDATION_DELAY_MS = 250;

export interface LiveValidation {
  /** `undefined` until the first run (or while the shared files load). */
  result: ScenarioValidation | undefined;
  /** The text changed and the new result is not there yet. */
  pending: boolean;
}

export const useValidation = (
  text: string,
  folderName: string,
  shared: SharedContent | undefined,
): LiveValidation => {
  const [state, setState] = useState<{ text: string; result: ScenarioValidation } | undefined>();

  useEffect(() => {
    if (shared === undefined) return;
    // The first run is immediate: the author sees the state of the file as soon as it opens.
    const delay = state === undefined ? 0 : VALIDATION_DELAY_MS;
    const timer = setTimeout(() => {
      setState({ text, result: validateScenarioText(text, folderName, shared) });
    }, delay);
    return () => clearTimeout(timer);
    // `state` only decides the delay of the first run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, folderName, shared]);

  return { result: state?.result, pending: state === undefined || state.text !== text };
};
