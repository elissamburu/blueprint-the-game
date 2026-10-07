// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  applyCommand,
  commands,
  createSession,
  resumeAttempt,
  slotNodes,
} from "@blueprint/game-engine";
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { createSessionStore } from "./session-store";
import { bundle, staticWebsiteScenario } from "./testing/game-fixture";

const scenario: Scenario = staticWebsiteScenario;
const rules: GameRules = bundle.rules;
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

  it("keeps the accepted commands that change the game, for the host to save (RF-PLAY-18)", () => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    store.getState().dispatch(commands.selectSlot(slot.id));
    store.getState().dispatch(commands.placeService(slot.id, optimal));
    store.getState().dispatch(commands.placeService(slot.id, "ec2"));
    expect(store.getState().commands).toEqual([commands.placeService(slot.id, optimal)]);
  });

  it("resumes a rebuilt session and restarts it with nothing played", () => {
    const played = [commands.placeService(slot.id, optimal)];
    const resumed = resumeAttempt(scenario, rules, {
      scenarioId: scenario.id,
      version: scenario.version,
      commands: played,
    });
    const store = createSessionStore();
    store.getState().resume(resumed.session, resumed.commands);
    expect(store.getState()).toMatchObject({ session: resumed.session, commands: played });

    store.getState().restart();
    expect(store.getState()).toMatchObject({
      session: createSession(scenario, rules),
      commands: [],
      lastOutcome: null,
    });
  });

  it("does nothing on restart without a session", () => {
    const store = createSessionStore();
    store.getState().restart();
    expect(store.getState().session).toBeNull();
  });

  it("ends the session", () => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    store.getState().end();
    expect(store.getState()).toMatchObject({ session: null, lastOutcome: null });
  });
});
