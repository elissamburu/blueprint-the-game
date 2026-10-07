// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { buildCuratedPalette } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { buildPalette, type PaletteContent } from "./palette.js";
import { gameRules, scenario, slot } from "./testing/fixtures.js";

const content: PaletteContent = {
  catalog: [
    { id: "lambda", type: "service", category: "compute", status: "active" },
    { id: "fargate", type: "service", category: "containers", status: "active" },
    { id: "ec2", type: "service", category: "compute", status: "active" },
    { id: "batch", type: "service", category: "compute", status: "active" },
    { id: "old-compute", type: "service", category: "compute", status: "deprecated" },
    { id: "route53", type: "service", category: "networking", status: "active" },
    { id: "s3", type: "service", category: "storage", status: "active" },
    { id: "old-storage", type: "service", category: "storage", status: "deprecated" },
    { id: "sqs", type: "service", category: "integration", status: "active" },
    { id: "cloudwatch", type: "service", category: "management", status: "active" },
    { id: "region", type: "concept", category: "concept-infra", status: "active" },
    { id: "availability-zone", type: "concept", category: "concept-infra", status: "active" },
    { id: "edge-location", type: "concept", category: "concept-infra", status: "active" },
  ],
  categories: [
    { id: "compute", adjacent: ["containers"] },
    { id: "containers", adjacent: [] },
    { id: "networking", adjacent: [] },
    { id: "storage", adjacent: ["compute"] },
    { id: "integration", adjacent: [] },
    { id: "management", adjacent: [] },
    { id: "concept-infra", adjacent: [] },
  ],
  confusionGroups: [
    { services: ["lambda", "batch"] },
    { services: ["region", "availability-zone", "edge-location"] },
  ],
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

  describe("concepts (RF-PAL-07)", () => {
    // Slot "b": the concept "region" is the answer; "edge-location" is a palette.extra.
    const conceptSlot = slot("b", {
      answers: [
        {
          service: "region",
          grade: "optimal",
          objectives: ["no-servers"],
          rationale: "Óptimo.",
          references: [],
        },
      ],
      incorrect: [],
    });
    const withConcepts = (mode: "categories" | "categories-plus" | "full") =>
      scenario([slot("a"), conceptSlot], { palette: { mode, extra: ["edge-location"] } });

    it.each(["categories", "categories-plus", "full"] as const)(
      "%s: never fills with concepts, only shows the ones the scenario uses",
      (mode) => {
        const services = buildPalette(withConcepts(mode), content).services;
        expect(services).toContain("region");
        expect(services).toContain("edge-location");
        expect(services).not.toContain("availability-zone");
      },
    );

    it("full: a scenario without concepts gets none", () => {
      expect(buildPalette(withMode("full"), content).services).not.toContain("region");
    });

    it("curated: concepts enter like any entry, confusion-group mates included", () => {
      const s = scenario([slot("a"), conceptSlot], { level: 100 });
      expect(buildPalette(s, content).services).toEqual([
        "lambda",
        "fargate",
        "region",
        "ec2",
        "route53",
        "batch",
        "availability-zone",
        "edge-location",
      ]);
    });
  });
});
