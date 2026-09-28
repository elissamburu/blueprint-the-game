// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { nodeById, runRule, slotById } from "../testing/fixtures.js";
import { l002 } from "./l002-services-in-catalog.js";

describe("L002 services exist in the catalog", () => {
  it("passes when every service is in the catalog", () => {
    expect(runRule(l002)).toEqual([]);
  });

  it("reports unknown services in fixed nodes, answers, incorrect and extra", () => {
    const issues = runRule(l002, (scenario) => {
      const logs = nodeById(scenario, "logs");
      if (logs.type === "fixed") logs.service = "cloudwatch-logs";
      const store = slotById(scenario, "store");
      store.answers[0]!.service = "s4";
      store.incorrect[0]!.service = "fsx";
      scenario.palette = { mode: "auto", extra: ["glacier"] };
    });
    expect(issues.map((issue) => [issue.severity, issue.path])).toEqual([
      ["error", ["diagram", "nodes", 1, "answers", 0, "service"]],
      ["error", ["diagram", "nodes", 1, "incorrect", 0, "service"]],
      ["error", ["diagram", "nodes", 3, "service"]],
      ["error", ["palette", "extra", 0]],
    ]);
    expect(issues[0]?.message).toBe(
      'El servicio "s4" no existe en el catálogo (content/catalog/services.yaml).',
    );
  });
});
