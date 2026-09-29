// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { evaluatePlacement, objectiveStatuses } from "./evaluate.js";
import { scenario, slot } from "./testing/fixtures.js";

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

describe("objectiveStatuses", () => {
  const node = slot("compute", {
    answers: [
      {
        service: "lambda",
        grade: "optimal",
        objectives: ["low-cost", "no-servers"],
        rationale: "Óptimo.",
        references: [],
      },
      {
        service: "fargate",
        grade: "acceptable",
        objectives: ["low-cost", "gone"],
        rationale: "Aceptable.",
        references: [],
      },
    ],
  });
  const { objectives } = scenario([node]);
  const [noServers, lowCost] = objectives;
  const statusesOf = (serviceId: string) =>
    objectiveStatuses(evaluatePlacement(node, serviceId), objectives);

  it("marks the objectives of an optimal answer as met, in scenario order", () => {
    expect(statusesOf("lambda")).toEqual([
      { objective: noServers, status: "met" },
      { objective: lowCost, status: "met" },
    ]);
  });

  it("marks the objectives of an acceptable answer as partial and skips unknown ids", () => {
    expect(statusesOf("fargate")).toEqual([{ objective: lowCost, status: "partial" }]);
  });

  it("marks the violated objectives of an incorrect entry", () => {
    expect(statusesOf("ec2")).toEqual([{ objective: noServers, status: "violated" }]);
    expect(statusesOf("route53")).toEqual([]);
  });

  it("returns nothing for an undeclared service", () => {
    expect(statusesOf("sns")).toEqual([]);
  });
});
