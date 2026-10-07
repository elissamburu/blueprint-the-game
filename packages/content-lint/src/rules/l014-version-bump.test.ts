// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Scenario } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { baseScenario, nodeById, slotById } from "../testing/fixtures.js";
import { checkVersionBump, gameplayChanges } from "./l014-version-bump.js";

const published = (status: Scenario["status"] = "published"): Scenario => ({
  ...baseScenario(),
  status,
});

/** A copy of `base` changed by `mutate`, keeping the same version unless it changes it. */
const changed = (base: Scenario, mutate: (scenario: Scenario) => void): Scenario => {
  const head = JSON.parse(JSON.stringify(base)) as Scenario;
  mutate(head);
  return head;
};

describe("L014 version bump", () => {
  it("does not apply to new scenarios or drafts on main", () => {
    const head = changed(published(), (s) => (s.level = 200));
    expect(checkVersionBump(undefined, head)).toEqual([]);
    expect(checkVersionBump(published("draft"), head)).toEqual([]);
  });

  it("passes when nothing that affects play changed", () => {
    const base = published();
    const head = changed(base, (s) => {
      s.title = "Otro título";
      s.context = "Otro contexto.";
      s.objectives[0]!.text = "Otro texto";
      const store = slotById(s, "store");
      store.answers[0]!.rationale = "Otra explicación.";
      store.answers[0]!.references = [];
      store.answers[0]!.objectives = ["low-cost"];
      store.incorrect[0]!.rationale = "Otra explicación.";
      store.hints = [];
      store.role = "Otro rol.";
      store.position = { x: 310, y: 130 };
      const thumbnailer = slotById(s, "thumbnailer");
      thumbnailer.answers.reverse();
      delete thumbnailer.incorrect[0]!.violates;
      s.diagram.edges[0]!.label = "Otra etiqueta";
      s.palette = { mode: "auto", extra: ["dynamodb", "dynamodb"] };
    });
    expect(gameplayChanges(base, head)).toEqual([]);
    expect(checkVersionBump(base, head)).toEqual([]);
  });

  it("does not require a bump for analogyLimit, which is text (ADR-0027 §2)", () => {
    const limit = (text: string) => ({
      text,
      references: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"],
    });
    const base = published();
    const added = changed(
      base,
      (s) => (slotById(s, "store").answers[0]!.analogyLimit = limit("A.")),
    );
    expect(checkVersionBump(base, added)).toEqual([]);
    const edited = changed(added, (s) => {
      slotById(s, "store").answers[0]!.analogyLimit = limit("Otro límite.");
    });
    expect(checkVersionBump(added, edited)).toEqual([]);
    const removed = changed(added, (s) => delete slotById(s, "store").answers[0]!.analogyLimit);
    expect(checkVersionBump(added, removed)).toEqual([]);
  });

  it("treats a missing palette as auto without extras", () => {
    const base = changed(published(), (s) => (s.palette = { mode: "auto", extra: [] }));
    const head = changed(base, (s) => delete s.palette);
    expect(checkVersionBump(base, head)).toEqual([]);
  });

  it("fails when a grade changes without a version bump", () => {
    const base = published();
    const head = changed(base, (s) => (slotById(s, "thumbnailer").answers[1]!.grade = "optimal"));
    expect(checkVersionBump(base, head)).toEqual([
      {
        code: "L014",
        severity: "error",
        message:
          'El escenario está published en main y cambió lo que define el resultado o las condiciones de juego (answers o grados de "thumbnailer"): incrementá version (en main es 1, en la rama 1).',
        path: ["version"],
      },
    ]);
  });

  it("passes when the version was incremented", () => {
    const base = published();
    const head = changed(base, (s) => {
      slotById(s, "thumbnailer").answers[1]!.grade = "optimal";
      s.version = 2;
    });
    expect(checkVersionBump(base, head)).toEqual([]);
  });

  it("lists every change that requires a bump", () => {
    const base = published();
    const head = changed(base, (s) => {
      s.level = 200;
      s.palette = { mode: "curated", maxSize: 8, extra: ["dynamodb"] };
      slotById(s, "store").answers[0]!.service = "efs";
      slotById(s, "store").incorrect[0]!.service = "s3";
      nodeById(s, "thumbnailer").id = "resizer";
    });
    expect(gameplayChanges(base, head)).toEqual([
      "level 100 → 200",
      "palette (mode, maxSize o extra)",
      'answers o grados de "store"',
      'incorrect de "store"',
      'se quitó el casillero "thumbnailer"',
      'se agregó el casillero "resizer"',
    ]);
  });

  it("protects beta and retired scenarios too", () => {
    for (const status of ["beta", "retired"] as const) {
      const base = published(status);
      const head = changed(base, (s) => (s.palette = { mode: "auto", extra: [] }));
      expect(checkVersionBump(base, head).map((issue) => issue.message)).toEqual([
        `El escenario está ${status} en main y cambió lo que define el resultado o las condiciones de juego (palette (mode, maxSize o extra)): incrementá version (en main es 1, en la rama 1).`,
      ]);
    }
  });
});
