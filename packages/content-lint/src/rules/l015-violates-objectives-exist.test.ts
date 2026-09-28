// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l015 } from "./l015-violates-objectives-exist.js";

describe("L015 violates references existing objectives", () => {
  it("passes when violates points to existing objectives or is absent", () => {
    expect(runRule(l015)).toEqual([]);
  });

  it("fails for an unknown objective", () => {
    const issues = runRule(l015, (scenario) => {
      slotById(scenario, "thumbnailer").incorrect[0]!.violates = ["no-servers", "no-vms"];
    });
    expect(issues).toEqual([
      {
        code: "L015",
        severity: "error",
        message:
          'El incorrect "ec2" del casillero "thumbnailer" dice violar el objetivo "no-vms", que no existe en objectives.',
        path: ["diagram", "nodes", 2, "incorrect", 0, "violates", 1],
      },
    ]);
  });
});
