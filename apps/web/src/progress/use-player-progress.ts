// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The stored progress seen against the loaded content: game-engine recomputes the open (area,
// level) pairs, so a new area or new scenarios count without waiting for the next save.
import { refreshUnlocks, type PlayerProgress } from "@blueprint/game-engine";
import { useMemo } from "react";
import type { ContentBundle } from "../content/load-bundle";
import { useProgressStore } from "./progress-store";

/** null without progress (before the onboarding, or while it is incompatible). */
export const usePlayerProgress = (bundle: ContentBundle): PlayerProgress | null => {
  const progress = useProgressStore((s) => s.progress);
  return useMemo(
    () =>
      progress === null
        ? null
        : refreshUnlocks(progress, bundle.index.scenarios, bundle.rules).progress,
    [progress, bundle],
  );
};
