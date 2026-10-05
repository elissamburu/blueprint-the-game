// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  applyCommand,
  commands,
  createSession,
  scenarioReview,
  slotNodes,
  type Command,
} from "@blueprint/game-engine";
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { createServiceLookup, slotViews } from "./board";
import { bundle, pdfScenario } from "./testing/game-fixture";

const scenario: Scenario = pdfScenario;
const rules: GameRules = bundle.rules;
const [entry, signer, store] = slotNodes(scenario);
if (entry === undefined || signer === undefined || store === undefined) {
  throw new Error("fixture without enough slots");
}
const acceptable = signer.answers.find((a) => a.grade === "acceptable")?.service ?? "";

const run = (...list: Command[]) =>
  list.reduce((s, c) => applyCommand(s, c).state, createSession(scenario, rules));

describe("createServiceLookup", () => {
  it("resolves catalog ids to name, category and icon, and unknown ids to undefined", () => {
    const lookup = createServiceLookup(
      [{ id: "s3", name: "Amazon S3", category: "storage" }],
      (id) => `/icons/${id}.svg`,
    );
    expect(lookup("s3")).toEqual({
      name: "Amazon S3",
      category: "storage",
      iconSrc: "/icons/s3.svg",
    });
    expect(lookup("nope")).toBeUndefined();
  });
});

describe("slotViews", () => {
  it("draws an empty session as empty slots with the hints of the scenario", () => {
    expect(slotViews(run())[entry.id]).toEqual({
      grade: "empty",
      number: 1,
      serviceId: null,
      hints: { used: 0, total: entry.hints.length },
      selected: false,
    });
  });

  it("takes grade, service, hints and selection from the engine", () => {
    const views = slotViews(
      run(
        commands.placeService(signer.id, acceptable),
        commands.useHint(signer.id),
        commands.selectSlot(signer.id),
        commands.placeService(store.id, "ec2"),
      ),
    );
    expect(views[signer.id]).toEqual({
      grade: "acceptable",
      number: 2,
      serviceId: acceptable,
      hints: { used: 1, total: signer.hints.length },
      selected: true,
    });
    expect(views[store.id]).toMatchObject({ grade: "incorrect", serviceId: "ec2" });
  });

  it("numbers the slots as the engine does, the order the summary reviews them in", () => {
    const views = slotViews(run());
    expect(slotNodes(scenario).map((node) => views[node.id]?.number)).toEqual(
      scenarioReview(scenario, []).map((item) => item.number),
    );
  });

  it("keeps an accepted orange orange", () => {
    const views = slotViews(
      run(commands.placeService(signer.id, acceptable), commands.acceptAcceptable(signer.id)),
    );
    expect(views[signer.id]?.grade).toBe("acceptable");
  });

  it("draws a revealed slot as a viewed solution with its optimal service, not as a green", () => {
    const optimal = store.answers.find((a) => a.grade === "optimal")?.service;
    const views = slotViews(run(commands.revealSolution(store.id)));
    expect(views[store.id]).toMatchObject({ grade: "revealed", serviceId: optimal });
  });
});
