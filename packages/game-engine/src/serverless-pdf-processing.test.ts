// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// End-to-end play of the real content/scenarios/serverless-pdf-processing (level 200, 7 slots)
// with the real game-rules: reds, oranges, hints and retries, then the player progress.
import { describe, expect, it } from "vitest";
import { applyScenarioResult, createProgress } from "./progress.js";
import { scenarioResult } from "./scoring.js";
import {
  applyCommand,
  commands,
  createSession,
  type CommandOutcome,
  type SessionState,
} from "./session.js";
import { gameRules, pdfScenario, realScenarios as allScenarios } from "./testing/fixtures.js";

const { placeService, useHint, acceptAcceptable, clearSlot } = commands;

describe("serverless-pdf-processing, end to end", () => {
  const mixedPlay = [
    // api-entry: red (violates a hard objective), hint, orange, "probar otra", green → 75 − 15 = 60
    placeService("api-entry", "ec2"),
    useHint("api-entry"),
    placeService("api-entry", "alb"),
    clearSlot("api-entry"),
    placeService("api-entry", "apigateway"),
    // url-signer: green at the first attempt → 100
    placeService("url-signer", "lambda"),
    // upload-store: 3 declared reds + 1 undeclared, hint, green → max(25, 0) − 15 = 10
    placeService("upload-store", "dynamodb"),
    placeService("upload-store", "efs"),
    placeService("upload-store", "ebs"),
    placeService("upload-store", "redshift"),
    useHint("upload-store"),
    placeService("upload-store", "s3"),
    // event-buffer: orange, another orange (no penalty), accepted → 50
    placeService("event-buffer", "kinesis-data-streams"),
    placeService("event-buffer", "eventbridge"),
    acceptAcceptable("event-buffer"),
    // processor: hint, green → 85
    useHint("processor"),
    placeService("processor", "lambda"),
    // extractor: orange, hint, accepted → 50 − 15 = 35
    placeService("extractor", "bedrock"),
    useHint("extractor"),
    acceptAcceptable("extractor"),
    // results-db: undeclared red, green → 75
    placeService("results-db", "sns"),
    placeService("results-db", "dynamodb"),
  ];

  const run = (cmds = mixedPlay) => {
    const outcomes: CommandOutcome[] = [];
    let state: SessionState = createSession(pdfScenario, gameRules);
    for (const cmd of cmds) {
      expect(state.completed).toBe(false);
      const result = applyCommand(state, cmd);
      outcomes.push(result.outcome);
      state = result.state;
    }
    return { state, outcomes };
  };

  it("returns the scenario's explanations and objective ids for each placement", () => {
    const { outcomes } = run();
    expect(outcomes.every((o) => o.type !== "rejected")).toBe(true);
    expect(outcomes[0]).toMatchObject({
      type: "servicePlaced",
      evaluation: {
        source: "incorrect",
        grade: "incorrect",
        violates: ["no-servers"],
        rationale:
          "Podrías montar un servidor web, pero tendrías que administrar el sistema operativo y los parches.",
      },
    });
    expect(outcomes[1]).toMatchObject({
      type: "hintRevealed",
      hint: "Pensá en un servicio que cobre por pedido y no por hora.",
    });
    expect(outcomes[2]).toMatchObject({
      evaluation: {
        source: "answer",
        grade: "acceptable",
        objectives: ["low-cost", "sporadic-traffic"],
      },
    });
    expect(outcomes[4]).toMatchObject({
      evaluation: {
        source: "answer",
        grade: "optimal",
        objectives: ["no-servers", "sporadic-traffic", "low-cost"],
        references: ["https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html"],
      },
    });
    expect(outcomes[9]).toEqual({
      type: "servicePlaced",
      slotId: "upload-store",
      evaluation: {
        source: "undeclared",
        grade: "incorrect",
        serviceId: "redshift",
        role: "Almacenamiento durable donde el navegador sube el PDF original usando la URL temporal.",
      },
    });
  });

  it("scores each slot, the total and the XP exactly", () => {
    const { state } = run();
    expect(state.completed).toBe(true);
    const result = scenarioResult(state);
    expect(result.slots.map((s) => [s.slotId, s.points, s.errors, s.hintsUsed])).toEqual([
      ["api-entry", 60, 1, 1],
      ["url-signer", 100, 0, 0],
      ["upload-store", 10, 4, 1],
      ["event-buffer", 50, 0, 0],
      ["processor", 85, 0, 1],
      ["extractor", 35, 0, 1],
      ["results-db", 75, 1, 0],
    ]);
    expect(result).toMatchObject({
      scenarioId: "serverless-pdf-processing",
      level: 200,
      completed: true,
      score: 415,
      maxScore: 700,
      multiplier: 1.5,
      xp: 623, // 415 × 1.5 = 622.5, rounded at the end
      hintsUsed: 4,
      perfect: false,
    });
  });

  it("updates the progress, then a perfect replay only adds the improvement", () => {
    const start = createProgress(
      { experience: "aws-user", interests: [] },
      allScenarios,
      gameRules,
    );
    const first = applyScenarioResult(start, scenarioResult(run().state), gameRules, allScenarios);
    expect(first.progress.xp).toBe(623);
    expect(first.events).toEqual([
      { type: "xpGained", amount: 623, total: 623 },
      // Its areas have their own level-200 scenario (this one); networking and security have
      // none, so they count level 200 of any area. 400 stays closed: the only level-300
      // scenario is still pending.
      {
        type: "levelUnlocked",
        level: 300,
        areas: ["integration", "networking", "security", "serverless", "storage"],
      },
    ]);

    const perfect = run(
      [
        ["api-entry", "apigateway"],
        ["url-signer", "lambda"],
        ["upload-store", "s3"],
        ["event-buffer", "sqs"],
        ["processor", "lambda"],
        ["extractor", "textract"],
        ["results-db", "dynamodb"],
      ].map(([slotId = "", serviceId = ""]) => placeService(slotId, serviceId)),
    );
    const replay = scenarioResult(perfect.state);
    expect(replay).toMatchObject({ score: 700, xp: 1050, perfect: true });

    const second = applyScenarioResult(first.progress, replay, gameRules, allScenarios);
    expect(second.progress.xp).toBe(1050);
    expect(second.events).toEqual([
      { type: "xpGained", amount: 427, total: 1050 },
      {
        type: "rankUp",
        from: { id: "aprendiz", name: "Aprendiz", minXp: 0 },
        to: { id: "constructor", name: "Constructor", minXp: 1000 },
      },
    ]);

    // Replaying worse never takes XP away.
    const third = applyScenarioResult(
      second.progress,
      scenarioResult(run().state),
      gameRules,
      allScenarios,
    );
    expect(third.progress.xp).toBe(1050);
    expect(third.events).toEqual([]);
  });
});
