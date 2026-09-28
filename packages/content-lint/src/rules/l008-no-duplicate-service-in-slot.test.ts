// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l008 } from "./l008-no-duplicate-service-in-slot.js";

describe("L008 no duplicate service in a slot", () => {
  it("passes when services are distinct within each slot", () => {
    expect(runRule(l008)).toEqual([]);
  });

  it("allows the same service in different slots", () => {
    expect(
      runRule(l008, (scenario) => {
        slotById(scenario, "store").incorrect[0]!.service = "ec2";
      }),
    ).toEqual([]);
  });

  it("fails for a service in answers and incorrect of the same slot", () => {
    const issues = runRule(l008, (scenario) => {
      slotById(scenario, "thumbnailer").incorrect[0]!.service = "fargate";
    });
    expect(issues).toEqual([
      {
        code: "L008",
        severity: "error",
        message:
          'El servicio "fargate" aparece más de una vez en el casillero "thumbnailer" (entre answers e incorrect).',
        path: ["diagram", "nodes", 2, "incorrect", 0, "service"],
      },
    ]);
  });

  it("fails for a service repeated inside answers", () => {
    const issues = runRule(l008, (scenario) => {
      slotById(scenario, "thumbnailer").answers[1]!.service = "lambda";
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ["diagram", "nodes", 2, "answers", 1, "service"],
    ]);
  });
});
