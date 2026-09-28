// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { evaluatePlacement } from "./evaluate.js";
import { slot } from "./testing/fixtures.js";

describe("evaluatePlacement", () => {
  const node = slot("compute");

  it("returns the declared grade, rationale, objectives and references of an answer", () => {
    expect(evaluatePlacement(node, "lambda")).toEqual({
      source: "answer",
      grade: "optimal",
      serviceId: "lambda",
      rationale: "Óptimo.",
      objectives: ["no-servers"],
      references: ["https://docs.aws.amazon.com/lambda/"],
    });
    expect(evaluatePlacement(node, "fargate")).toMatchObject({
      grade: "acceptable",
      objectives: ["low-cost"],
    });
  });

  it("returns red with the specific rationale and violated objectives of an incorrect entry", () => {
    expect(evaluatePlacement(node, "ec2")).toEqual({
      source: "incorrect",
      grade: "incorrect",
      serviceId: "ec2",
      rationale: "Viola.",
      violates: ["no-servers"],
    });
    expect(evaluatePlacement(node, "route53")).toMatchObject({ violates: [] });
  });

  it("returns red with the role for the UI's generic explanation when undeclared", () => {
    expect(evaluatePlacement(node, "sns")).toEqual({
      source: "undeclared",
      grade: "incorrect",
      serviceId: "sns",
      role: "Rol de compute",
    });
  });
});
