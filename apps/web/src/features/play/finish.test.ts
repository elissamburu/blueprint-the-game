// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  applyCommand,
  commands,
  createProgress,
  slotNodes,
  type PlayerProgress,
  type SessionState,
} from "@blueprint/game-engine";
import { describe, expect, it, vi } from "vitest";
import i18n from "i18next";
import "../../i18n";
import { finishScenario, progressEventText, SummaryStateSchema, summaryState } from "./finish";
import { bundle, newSession, pdfScenario } from "./testing/game-fixture";

/** Every slot green at the first attempt. */
const completed = (): SessionState =>
  slotNodes(pdfScenario).reduce((state, node) => {
    const optimal = node.answers.find((a) => a.grade === "optimal");
    if (optimal === undefined) throw new Error("slot without optimal");
    return applyCommand(state, commands.placeService(node.id, optimal.service)).state;
  }, newSession());

const t = i18n.t.bind(i18n);

describe("finishScenario", () => {
  it("applies the result to the progress, saves it and returns the engine events", async () => {
    const progress: PlayerProgress = createProgress(
      { experience: "beginner", interests: [] },
      bundle.index.scenarios,
      bundle.rules,
    );
    const save = vi.fn(() => Promise.resolve());
    const session = completed();
    const outcome = await finishScenario({
      session,
      progress,
      rules: bundle.rules,
      scenarios: bundle.index.scenarios,
      save,
    });
    const slots = slotNodes(pdfScenario).length;
    expect(outcome.result.score).toBe(slots * bundle.rules.scoring.firstTryGreen);
    expect(outcome.result.xp).toBe(
      Math.round(outcome.result.score * bundle.rules.levelMultipliers["200"]),
    );
    expect(outcome.saved).toBe(true);
    expect(outcome.xpGained).toBe(outcome.result.xp);
    expect(outcome.events[0]).toEqual({
      type: "xpGained",
      amount: outcome.result.xp,
      total: outcome.result.xp,
    });
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0] as unknown as [PlayerProgress];
    expect(saved[0].xp).toBe(outcome.result.xp);
    expect(saved[0].best[pdfScenario.id]?.score).toBe(outcome.result.score);
  });

  it("does not save anything without progress (before onboarding)", async () => {
    const save = vi.fn(() => Promise.resolve());
    const outcome = await finishScenario({
      session: completed(),
      progress: null,
      rules: bundle.rules,
      scenarios: bundle.index.scenarios,
      save,
    });
    expect(save).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ saved: false, xpGained: 0, events: [] });
    expect(outcome.result.completed).toBe(true);
  });
});

describe("progressEventText", () => {
  it("writes the toasts of RF-GAM-10 with names from the content", () => {
    const areas = bundle.index.areas;
    const [first, second] = bundle.rules.ranks;
    if (first === undefined || second === undefined) throw new Error("fixture with < 2 ranks");
    expect(progressEventText(t, { type: "xpGained", amount: 300, total: 1300 }, areas)).toBe(
      "+300 XP (total: 1300 XP)",
    );
    expect(progressEventText(t, { type: "rankUp", from: first, to: second }, areas)).toBe(
      `¡Subiste de rango: ${second.name}!`,
    );
    const [a, b] = areas;
    if (a === undefined || b === undefined) throw new Error("fixture with < 2 areas");
    expect(
      progressEventText(t, { type: "levelUnlocked", level: 200, areas: [a.id, b.id] }, areas),
    ).toBe(`Desbloqueaste el nivel 200 en ${a.name} y ${b.name}.`);
  });
});

describe("summaryState", () => {
  it("is what the summary route validates", async () => {
    const outcome = await finishScenario({
      session: completed(),
      progress: null,
      rules: bundle.rules,
      scenarios: bundle.index.scenarios,
      save: () => Promise.resolve(),
    });
    expect(SummaryStateSchema.parse(summaryState(outcome))).toEqual({
      score: outcome.result.score,
      maxScore: outcome.result.maxScore,
      xp: outcome.result.xp,
      xpGained: 0,
      saved: false,
    });
  });
});
