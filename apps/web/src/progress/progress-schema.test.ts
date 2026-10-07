// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Level 0 and «Recién empiezo con la nube» in the stored progress (ADR-0027 §3): only new values
// are possible, so there is no migration, and the level 0 of an existing player comes from
// game-rules.yaml when the unlocks are recomputed against the content.
import { recommendedScenario, refreshUnlocks } from "@blueprint/game-engine";
import { describe, expect, it } from "vitest";
import { bundle } from "../features/play/testing/game-fixture";
import { PROGRESS_SCHEMA_VERSION, readStoredProgress } from "./progress-schema";

/** A beginner saved before F2.1: no level 0 anywhere, levels 100 open in their areas. */
const oldBeginner = `{
  "schemaVersion": 2,
  "progress": {
    "experience": "beginner",
    "interests": ["storage"],
    "xp": 0,
    "best": {},
    "unlocked": [
      { "area": "networking", "level": 100 },
      { "area": "serverless", "level": 100 },
      { "area": "storage", "level": 100 }
    ],
    "started": []
  }
}`;

/** The real scenarios plus a level 0 one of «fundamentos». */
const scenarios = [
  ...bundle.index.scenarios,
  { id: "pizzeria", level: 0 as const, areas: ["fundamentos"] },
];

describe("stored progress with level 0", () => {
  it("reads a progress saved before level 0 existed, without a migration", () => {
    expect(PROGRESS_SCHEMA_VERSION).toBe(2);
    const read = readStoredProgress(JSON.parse(oldBeginner));
    expect(read).toMatchObject({ ok: true, migratedFrom: null });
  });

  it("opens level 0 for that player in every area, and they still start at 100", () => {
    const read = readStoredProgress(JSON.parse(oldBeginner));
    if (!read.ok) throw new Error("the old progress should be readable");
    const { progress } = refreshUnlocks(read.progress, scenarios, bundle.rules);
    const areas = [...new Set(progress.unlocked.map((u) => u.area))];
    for (const area of areas) {
      expect(progress.unlocked.filter((u) => u.area === area).map((u) => u.level)).toEqual([
        0, 100,
      ]);
    }
    expect(areas).toContain("fundamentos");
    // The recommended scenario comes from the highest open level (RF-NAV-02).
    expect(recommendedScenario(progress, scenarios)?.id).toBe("static-website-https");
  });

  it("accepts «newcomer» and level 0 in the unlocked pairs and the best results", () => {
    const read = readStoredProgress({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      progress: {
        experience: "newcomer",
        interests: ["fundamentos"],
        xp: 143,
        best: {
          pizzeria: {
            version: 1,
            level: 0,
            areas: ["fundamentos"],
            score: 285,
            maxScore: 300,
            xp: 143,
            hintsUsed: 1,
            perfect: false,
            allOptimal: true,
          },
        },
        unlocked: [{ area: "fundamentos", level: 0 }],
        started: ["pizzeria"],
      },
    });
    expect(read.ok).toBe(true);
  });

  it("still rejects a level that does not exist", () => {
    const read = readStoredProgress(JSON.parse(oldBeginner.replace('"level": 100', '"level": 50')));
    expect(read).toMatchObject({ ok: false, kind: "invalid" });
  });
});
