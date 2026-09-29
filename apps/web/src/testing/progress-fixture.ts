// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Stored progress for the route tests: created by game-engine against the real bundle and saved
// in the current format, as the onboarding would.
import { createProgress, type PlayerProgress } from "@blueprint/game-engine";
import type { Experience } from "@blueprint/scenario-schema";
import { bundle } from "../features/play/testing/game-fixture";
import { PROGRESS_STORAGE_KEY } from "../progress/local-storage-progress-repository";
import { PROGRESS_SCHEMA_VERSION } from "../progress/progress-schema";

export const newProgress = (
  experience: Experience,
  interests: readonly string[] = ["serverless"],
): PlayerProgress =>
  createProgress({ experience, interests }, bundle.index.scenarios, bundle.rules);

export const storeProgress = (progress: PlayerProgress): void =>
  localStorage.setItem(
    PROGRESS_STORAGE_KEY,
    JSON.stringify({ schemaVersion: PROGRESS_SCHEMA_VERSION, progress }),
  );

export const storedProgress = (): PlayerProgress | null => {
  const text = localStorage.getItem(PROGRESS_STORAGE_KEY);
  return text === null ? null : (JSON.parse(text) as { progress: PlayerProgress }).progress;
};
