// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Unlock path of a new beginner through the real content/scenarios (levels 100, 200, 300).
import type { Scenario } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { applyScenarioResult, createProgress, type PlayerProgress } from "./progress.js";
import { scenarioResult } from "./scoring.js";
import { applyCommand, commands, createSession, slotNodes } from "./session.js";
import {
  gameRules,
  pdfScenario,
  privateVpcScenario,
  realScenarios,
  staticWebsiteScenario,
} from "./testing/fixtures.js";
import { isScenarioPlayable, type LevelUnlock } from "./unlocks.js";

/** Completes a scenario placing the first optimal answer of every slot. */
const complete = (progress: PlayerProgress, scenario: Scenario) => {
  const state = slotNodes(scenario).reduce(
    (current, node) => {
      const optimal = node.answers.find((answer) => answer.grade === "optimal");
      if (optimal === undefined) throw new Error(`${node.id} has no optimal answer`);
      return applyCommand(current, commands.placeService(node.id, optimal.service)).state;
    },
    createSession(scenario, gameRules),
  );
  expect(state.completed).toBe(true);
  return applyScenarioResult(progress, scenarioResult(state), gameRules, realScenarios);
};

const pairs = (areas: string[], levels: LevelUnlock["level"][]): LevelUnlock[] =>
  areas.flatMap((area) => levels.map((level) => ({ area, level })));
const areas = ["integration", "networking", "security", "serverless", "storage"];
const playable = (progress: PlayerProgress) =>
  realScenarios.filter((s) => isScenarioPlayable(progress.unlocked, s)).map((s) => s.id);

describe("beginner path through the real scenarios", () => {
  it("starts with only level 100 open in every area", () => {
    const progress = createProgress("beginner", realScenarios, gameRules);
    expect(progress.unlocked).toEqual(pairs(areas, [100]));
    expect(playable(progress)).toEqual([staticWebsiteScenario.id]);
  });

  it("opens 200 after the level-100 scenario and 300 after the level-200 one, never 400", () => {
    const start = createProgress("beginner", realScenarios, gameRules);

    const afterStatic = complete(start, staticWebsiteScenario);
    // networking and storage count their own scenario; the other areas have no level-100
    // scenarios, so they count level 100 of any area.
    expect(afterStatic.progress.unlocked).toEqual(pairs(areas, [100, 200]));
    expect(afterStatic.events).toContainEqual({ type: "levelUnlocked", level: 200, areas });
    expect(playable(afterStatic.progress)).toEqual([staticWebsiteScenario.id, pdfScenario.id]);

    const afterPdf = complete(afterStatic.progress, pdfScenario);
    expect(afterPdf.progress.unlocked).toEqual(pairs(areas, [100, 200, 300]));
    expect(afterPdf.events).toContainEqual({ type: "levelUnlocked", level: 300, areas });
    expect(afterPdf.progress.unlocked.some((u) => u.level === 400)).toBe(false);
    expect(playable(afterPdf.progress)).toEqual(realScenarios.map((s) => s.id));
    expect(privateVpcScenario.level).toBe(300);
  });
});
