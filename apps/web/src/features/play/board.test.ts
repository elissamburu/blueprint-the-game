// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  applyCommand,
  commands,
  createSession,
  slotNodes,
  type Command,
} from "@blueprint/game-engine";
import {
  parseGameRules,
  parseScenario,
  type GameRules,
  type Scenario,
} from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { bundleFiles } from "../../content/testing/bundle-fixture";
import { createServiceLookup, slotViews } from "./board";

const files = bundleFiles();
const unwrap = <T>(result: { success: true; data: T } | { success: false }): T => {
  if (!result.success) throw new Error("invalid fixture");
  return result.data;
};
const scenario: Scenario = unwrap(parseScenario(files["serverless-pdf-processing.v1.json"]));
const rules: GameRules = unwrap(parseGameRules(files["game-rules.json"]));
const [entry, signer, store] = slotNodes(scenario);
if (entry === undefined || signer === undefined || store === undefined) {
  throw new Error("fixture without enough slots");
}
const acceptable = signer.answers.find((a) => a.grade === "acceptable")?.service ?? "";

const run = (...list: Command[]) =>
  list.reduce((s, c) => applyCommand(s, c).state, createSession(scenario, rules));

describe("createServiceLookup", () => {
  it("resolves catalog ids to name, category and icon, and unknown ids to undefined", () => {
    const lookup = createServiceLookup([{ id: "s3", name: "Amazon S3", category: "storage" }]);
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
      serviceId: acceptable,
      hints: { used: 1, total: signer.hints.length },
      selected: true,
    });
    expect(views[store.id]).toMatchObject({ grade: "incorrect", serviceId: "ec2" });
  });

  it("keeps an accepted orange orange", () => {
    const views = slotViews(
      run(commands.placeService(signer.id, acceptable), commands.acceptAcceptable(signer.id)),
    );
    expect(views[signer.id]?.grade).toBe("acceptable");
  });
});
