// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { applyCommand, commands, createSession, slotNodes } from "@blueprint/game-engine";
import {
  parseGameRules,
  parseScenario,
  type GameRules,
  type Scenario,
} from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { bundleFiles } from "../../content/testing/bundle-fixture";
import { createSessionStore } from "./session-store";

const files = bundleFiles();
const unwrap = <T>(result: { success: true; data: T } | { success: false }): T => {
  if (!result.success) throw new Error("invalid fixture");
  return result.data;
};
const scenario: Scenario = unwrap(parseScenario(files["static-website-https.v1.json"]));
const rules: GameRules = unwrap(parseGameRules(files["game-rules.json"]));
const [slot] = slotNodes(scenario);
if (slot === undefined) throw new Error("fixture without slots");
const optimal = slot.answers.find((a) => a.grade === "optimal")?.service ?? "";

describe("session store", () => {
  it("ignores commands when there is no session", () => {
    const store = createSessionStore();
    expect(store.getState().dispatch(commands.selectSlot(slot.id))).toBeNull();
  });

  it("delegates every command to the game-engine reducer", () => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    const command = commands.placeService(slot.id, optimal);
    const outcome = store.getState().dispatch(command);

    const expected = applyCommand(createSession(scenario, rules), command);
    expect(outcome).toEqual(expected.outcome);
    expect(store.getState().session).toEqual(expected.state);
    expect(store.getState().lastOutcome).toEqual(expected.outcome);
  });

  it("keeps the state of rejected commands and reports the rejection", () => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    store.getState().dispatch(commands.placeService(slot.id, optimal));
    const before = store.getState().session;
    const outcome = store.getState().dispatch(commands.placeService(slot.id, "ec2"));
    expect(outcome).toMatchObject({ type: "rejected", reason: "slot-locked" });
    expect(store.getState().session).toBe(before);
  });

  it("ends the session", () => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    store.getState().end();
    expect(store.getState()).toMatchObject({ session: null, lastOutcome: null });
  });
});
