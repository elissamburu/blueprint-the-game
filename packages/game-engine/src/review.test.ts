// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { reviewCounts, scenarioReview, slotResultStatus } from "./review.js";
import { scenarioMaxScore, scenarioResult } from "./scoring.js";
import { applyCommand, commands, createSession, slotNodes, type Command } from "./session.js";
import { gameRules, pdfScenario, scenario, slot } from "./testing/fixtures.js";

const twoSlots = scenario([
  slot("a"),
  slot("b", {
    answers: [
      {
        service: "s3",
        grade: "optimal",
        objectives: ["no-servers"],
        rationale: "Primera óptima.",
        references: ["https://docs.aws.amazon.com/s3/"],
      },
      {
        service: "efs",
        grade: "acceptable",
        objectives: ["low-cost"],
        rationale: "Aceptable.",
        references: [],
      },
      {
        service: "dynamodb",
        grade: "optimal",
        objectives: ["low-cost"],
        rationale: "Segunda óptima.",
        references: [],
      },
    ],
  }),
]);

const play = (...cmds: Command[]) =>
  cmds.reduce((state, cmd) => applyCommand(state, cmd).state, createSession(twoSlots, gameRules));

describe("scenarioMaxScore", () => {
  it("is firstTryGreen per slot, without the level multiplier", () => {
    expect(scenarioMaxScore(twoSlots, gameRules)).toBe(200);
    expect(scenarioMaxScore(pdfScenario, gameRules)).toBe(
      gameRules.scoring.firstTryGreen * slotNodes(pdfScenario).length,
    );
    expect(scenarioResult(createSession(pdfScenario, gameRules)).maxScore).toBe(
      scenarioMaxScore(pdfScenario, gameRules),
    );
  });
});

describe("slotResultStatus", () => {
  it("reads the grade and whether the orange was kept", () => {
    expect(slotResultStatus({ grade: null, accepted: false })).toBe("empty");
    expect(slotResultStatus({ grade: "optimal", accepted: false })).toBe("optimal");
    expect(slotResultStatus({ grade: "acceptable", accepted: false })).toBe("acceptable");
    expect(slotResultStatus({ grade: "acceptable", accepted: true })).toBe("accepted");
    expect(slotResultStatus({ grade: "incorrect", accepted: false })).toBe("incorrect");
  });
});

describe("scenarioReview (RF-PLAY-09)", () => {
  it("lists every slot in diagram order with the choice, the hints and the optimal answers", () => {
    const state = play(
      commands.useHint("a"),
      commands.placeService("a", "ec2"),
      commands.clearSlot("a"),
      commands.placeService("a", "lambda"),
      commands.placeService("b", "efs"),
      commands.acceptAcceptable("b"),
    );
    expect(scenarioReview(twoSlots, scenarioResult(state).slots)).toEqual([
      {
        number: 1,
        slotId: "a",
        role: "Rol de a",
        chosen: "lambda",
        status: "optimal",
        hintsUsed: 1,
        errors: 1,
        // 100 − 25 (one red) − 15 (one hint).
        points: 60,
        optimal: [
          {
            serviceId: "lambda",
            rationale: "Óptimo.",
            references: ["https://docs.aws.amazon.com/lambda/"],
          },
        ],
      },
      {
        number: 2,
        slotId: "b",
        role: "Rol de b",
        chosen: "efs",
        status: "accepted",
        hintsUsed: 0,
        errors: 0,
        points: 50,
        optimal: [
          {
            serviceId: "s3",
            rationale: "Primera óptima.",
            references: ["https://docs.aws.amazon.com/s3/"],
          },
          { serviceId: "dynamodb", rationale: "Segunda óptima.", references: [] },
        ],
      },
    ]);
  });

  it("reviews a slot without a result as empty", () => {
    const [first] = scenarioReview(twoSlots, []);
    expect(first).toMatchObject({ chosen: null, status: "empty", hintsUsed: 0, points: 0 });
  });

  it("covers the real scenario, with references for every optimal answer", () => {
    const review = scenarioReview(
      pdfScenario,
      scenarioResult(createSession(pdfScenario, gameRules)).slots,
    );
    expect(review.map((r) => r.slotId)).toEqual(slotNodes(pdfScenario).map((n) => n.id));
    expect(review.every((r) => r.optimal.length > 0)).toBe(true);
    expect(review.flatMap((r) => r.optimal).every((a) => a.references.length > 0)).toBe(true);
  });
});

describe("reviewCounts", () => {
  it("counts the slots of each status", () => {
    const state = play(
      commands.placeService("a", "lambda"),
      commands.placeService("b", "efs"),
      commands.acceptAcceptable("b"),
    );
    expect(reviewCounts(scenarioReview(twoSlots, scenarioResult(state).slots))).toEqual({
      optimal: 1,
      accepted: 1,
      acceptable: 0,
      incorrect: 0,
      empty: 0,
    });
  });
});
