// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c004 } from "./c004-confusion-group-size.js";

describe("C004 confusion groups have ≥ 2 distinct services", () => {
  it("passes for groups without repeated services", () => {
    expect(runSharedRule(c004)).toEqual([]);
  });

  it("reports a repeated service but accepts the group if two distinct remain", () => {
    const issues = runSharedRule(c004, (input) => {
      input.confusionGroups[0]!.services.push("ec2");
    });
    expect(issues).toEqual([
      {
        code: "C004",
        severity: "error",
        message: 'El grupo de confusión "compute" repite el servicio "ec2".',
        path: ["confusionGroups", 0, "services", 3],
      },
    ]);
  });

  it("fails for a group with a single distinct service", () => {
    const issues = runSharedRule(c004, (input) => {
      input.confusionGroups[0]!.services = ["lambda", "lambda"];
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      'El grupo de confusión "compute" repite el servicio "lambda".',
      'El grupo de confusión "compute" tiene 1 servicio distinto: necesita al menos dos.',
    ]);
    expect(issues[1]?.path).toEqual(["confusionGroups", 0, "services"]);
  });
});
