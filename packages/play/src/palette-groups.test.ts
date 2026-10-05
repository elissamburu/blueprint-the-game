// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { buildPalette } from "@blueprint/game-engine";
import { describe, expect, it } from "vitest";
import { groupPalette, matchesQuery } from "./palette-groups";
import { bundle, pdfScenario, services } from "./testing/game-fixture";

const { categories } = bundle.catalog;

describe("groupPalette", () => {
  it("groups the engine palette by category, in categories.yaml order", () => {
    const palette = buildPalette(pdfScenario, {
      catalog: bundle.catalog.services,
      categories,
      confusionGroups: bundle.catalog.confusionGroups,
      rules: bundle.rules,
    });
    const groups = groupPalette(palette.services, services, categories);
    const order = categories.map((c) => c.id);
    const ids = groups.map((g) => g.category.id);
    expect(ids).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    expect(groups.flatMap((g) => g.services.map((s) => s.id)).sort()).toEqual(
      [...palette.services].sort(),
    );
    for (const group of groups) {
      expect(group.services.every((s) => s.category === group.category.id)).toBe(true);
    }
  });

  it("filters by name and aliases and drops empty groups", () => {
    const groups = groupPalette(["s3", "lambda", "sqs"], services, categories, "objetos");
    expect(groups.map((g) => g.services.map((s) => s.id))).toEqual([["s3"]]);
  });

  it("skips ids missing from the catalog", () => {
    expect(groupPalette(["no-such-service"], services, categories)).toEqual([]);
  });
});

describe("matchesQuery", () => {
  const s3 = { name: "Amazon S3", fullName: "Amazon Simple Storage Service", aliases: ["buckets"] };

  it("ignores case, accents and surrounding spaces", () => {
    expect(matchesQuery(s3, "  SIMPLE storage ")).toBe(true);
    expect(matchesQuery({ name: "Función", aliases: [] }, "funcion")).toBe(true);
    expect(matchesQuery(s3, "bucket")).toBe(true);
    expect(matchesQuery(s3, "")).toBe(true);
    expect(matchesQuery(s3, "cola")).toBe(false);
  });
});
