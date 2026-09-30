// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ScenarioStatus } from "@blueprint/game-engine";
import { describe, expect, it } from "vitest";
import { filterScenarios, NO_FILTERS, sortScenarios } from "./filters";

const scenarios: { id: string; level: 100 | 200; areas: string[]; title: string }[] = [
  { id: "a", level: 100, areas: ["networking", "storage"], title: "B" },
  { id: "b", level: 200, areas: ["serverless"], title: "A" },
  { id: "c", level: 100, areas: ["serverless"], title: "A" },
];

const statuses: Record<string, ScenarioStatus> = {
  a: "completed-green",
  b: "in-progress",
  c: "completed",
};
const statusOf = (id: string) => statuses[id] ?? "new";
const ids = (list: readonly { id: string }[]) => list.map((s) => s.id);

describe("filterScenarios", () => {
  it("keeps everything without filters", () => {
    expect(ids(filterScenarios(scenarios, NO_FILTERS, statusOf))).toEqual(["a", "b", "c"]);
  });

  it("filters by level, area and status, combined", () => {
    expect(ids(filterScenarios(scenarios, { ...NO_FILTERS, level: 100 }, statusOf))).toEqual([
      "a",
      "c",
    ]);
    expect(
      ids(filterScenarios(scenarios, { ...NO_FILTERS, area: "serverless" }, statusOf)),
    ).toEqual(["b", "c"]);
    expect(
      ids(filterScenarios(scenarios, { ...NO_FILTERS, status: "completed" }, statusOf)),
    ).toEqual(["c"]);
    expect(
      ids(
        filterScenarios(
          scenarios,
          { level: 100, area: "serverless", status: "completed-green" },
          statusOf,
        ),
      ),
    ).toEqual([]);
  });

  it("ignores the status filter without progress", () => {
    expect(ids(filterScenarios(scenarios, { ...NO_FILTERS, status: "new" }, null))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("sortScenarios", () => {
  it("sorts by level and then by title", () => {
    expect(ids(sortScenarios(scenarios))).toEqual(["c", "a", "b"]);
  });
});
