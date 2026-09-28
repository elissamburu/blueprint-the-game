// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { buildCuratedPalette } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { buildPalette, type PaletteContent } from "./palette.js";
import { gameRules, scenario, slot } from "./testing/fixtures.js";

const content: PaletteContent = {
  catalog: [
    { id: "lambda", category: "compute", status: "active" },
    { id: "fargate", category: "containers", status: "active" },
    { id: "ec2", category: "compute", status: "active" },
    { id: "batch", category: "compute", status: "active" },
    { id: "old-compute", category: "compute", status: "deprecated" },
    { id: "route53", category: "networking", status: "active" },
    { id: "s3", category: "storage", status: "active" },
    { id: "old-storage", category: "storage", status: "deprecated" },
    { id: "sqs", category: "integration", status: "active" },
    { id: "cloudwatch", category: "management", status: "active" },
  ],
  categories: [
    { id: "compute", adjacent: ["containers"] },
    { id: "containers", adjacent: [] },
    { id: "networking", adjacent: [] },
    { id: "storage", adjacent: ["compute"] },
    { id: "integration", adjacent: [] },
    { id: "management", adjacent: [] },
  ],
  confusionGroups: [{ services: ["lambda", "batch"] }],
  rules: gameRules,
};

// Answers: lambda (compute) optimal, fargate (containers) acceptable; incorrect: ec2, route53.
const withMode = (mode: "categories" | "categories-plus" | "full", extra: string[] = []) =>
  scenario([slot("a")], { palette: { mode, extra } });

describe("buildPalette", () => {
  it("resolves auto by level and uses the curated build of scenario-schema", () => {
    const s = scenario([slot("a")], { level: 100 });
    const palette = buildPalette(s, content);
    expect(palette.mode).toBe("curated");
    expect(palette.services).toEqual(
      buildCuratedPalette(s, content.catalog, content.confusionGroups, gameRules).services,
    );
    expect(palette.services).toEqual(["lambda", "fargate", "ec2", "route53", "batch"]);
  });

  it("categories: every active service of the answers' categories plus the used ones", () => {
    expect(buildPalette(withMode("categories", ["old-storage"]), content)).toEqual({
      mode: "categories",
      services: ["lambda", "fargate", "ec2", "batch", "route53", "old-storage"],
    });
  });

  it("categories-plus: adds the adjacent categories, in both directions", () => {
    expect(buildPalette(withMode("categories-plus"), content).services).toEqual([
      "lambda",
      "fargate",
      "ec2",
      "batch",
      "route53",
      "s3",
    ]);
  });

  it("full: the whole catalog without deprecated services the scenario does not use", () => {
    expect(buildPalette(withMode("full"), content).services).toEqual([
      "lambda",
      "fargate",
      "ec2",
      "batch",
      "route53",
      "s3",
      "sqs",
      "cloudwatch",
    ]);
  });

  it("resolves auto for the other levels from game-rules", () => {
    expect(buildPalette(scenario([slot("a")], { level: 200 }), content).mode).toBe("categories");
    expect(buildPalette(scenario([slot("a")], { level: 300 }), content).mode).toBe(
      "categories-plus",
    );
    expect(buildPalette(scenario([slot("a")], { level: 400 }), content).mode).toBe("full");
  });
});
