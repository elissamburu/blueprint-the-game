// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l019 } from "./l019-areas-exist.js";

describe("L019 scenario areas exist", () => {
  it("passes when every area exists in areas.yaml", () => {
    expect(runRule(l019)).toEqual([]);
  });

  it("fails for an unknown area", () => {
    const issues = runRule(l019, (scenario) => {
      scenario.areas = ["serverless", "networking"];
    });
    expect(issues).toEqual([
      {
        code: "L019",
        severity: "error",
        message: 'El escenario pertenece al área "networking", que no existe en areas.yaml.',
        path: ["areas", 1],
      },
    ]);
  });
});
