// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c003 } from "./c003-confusion-group-services.js";

describe("C003 confusion group services exist", () => {
  it("passes when every service exists in the catalog", () => {
    expect(runSharedRule(c003)).toEqual([]);
  });

  it("fails for a service missing from the catalog", () => {
    const issues = runSharedRule(c003, (input) => {
      input.confusionGroups[0]!.services.push("ecs");
    });
    expect(issues).toEqual([
      {
        code: "C003",
        severity: "error",
        message:
          'El grupo de confusión "compute" incluye "ecs", que no existe en catalog/services.yaml.',
        path: ["confusionGroups", 0, "services", 3],
      },
    ]);
  });
});
