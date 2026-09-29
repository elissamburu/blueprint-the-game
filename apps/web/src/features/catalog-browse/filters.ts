// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Filters of the scenario listing (RF-NAV-01): level, area and status. The status of each
// scenario comes from game-engine (scenarioStatus); this only keeps the matching cards.
import type { ScenarioStatus } from "@blueprint/game-engine";
import type { BundleIndexEntry } from "@blueprint/scenario-schema";

export type LevelFilter = BundleIndexEntry["level"] | "all";

export interface ScenarioFilters {
  readonly level: LevelFilter;
  /** Area id, or "all". */
  readonly area: string;
  readonly status: ScenarioStatus | "all";
}

export const NO_FILTERS: ScenarioFilters = { level: "all", area: "all", status: "all" };

/**
 * Scenarios that match every filter, in the given order. `statusOf` is null without progress:
 * then the status filter does not apply.
 */
export const filterScenarios = <T extends Pick<BundleIndexEntry, "id" | "level" | "areas">>(
  scenarios: readonly T[],
  filters: ScenarioFilters,
  statusOf: ((scenarioId: string) => ScenarioStatus) | null,
): T[] =>
  scenarios.filter(
    (scenario) =>
      (filters.level === "all" || scenario.level === filters.level) &&
      (filters.area === "all" || scenario.areas.includes(filters.area)) &&
      (filters.status === "all" || statusOf === null || statusOf(scenario.id) === filters.status),
  );

/** Listing order: easiest first, then by title (as in the design). */
export const sortScenarios = <T extends Pick<BundleIndexEntry, "level" | "title">>(
  scenarios: readonly T[],
): T[] => [...scenarios].sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "es"));
