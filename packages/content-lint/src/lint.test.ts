// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  formatIssues,
  parseAreas,
  parseBadges,
  parseCategories,
  parseConfusionGroups,
  parseGameRules,
  parseScenario,
  parseServices,
  type ParseResult,
} from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import areasRaw from "../../../content/areas.yaml?raw";
import badgesRaw from "../../../content/badges/badges.yaml?raw";
import categoriesRaw from "../../../content/catalog/categories.yaml?raw";
import confusionGroupsRaw from "../../../content/catalog/confusion-groups.yaml?raw";
import servicesRaw from "../../../content/catalog/services.yaml?raw";
import gameRulesRaw from "../../../content/game-rules.yaml?raw";
import pdfRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import { hasErrors, lintScenario, lintSharedContent, rules, sharedRules } from "./index.js";
import { baseInput, baseSharedInput, gameRules } from "./testing/fixtures.js";
import { pdfCatalog, pdfConfusionGroups } from "./testing/pdf-catalog.js";
import type { Issue } from "./types.js";

describe("lintScenario", () => {
  it("returns no issues for the base fixture", () => {
    expect(lintScenario(baseInput())).toEqual([]);
  });

  it("registers each rule once, in code order", () => {
    const codes = rules.map((rule) => rule.code);
    expect(codes).toEqual([...new Set(codes)].sort());
    expect(codes).toEqual([
      "L001",
      "L002",
      "L003",
      "L004",
      "L005",
      "L006",
      "L007",
      "L008",
      "L009",
      "L010",
      "L011",
      "L015",
      "L016",
      "L018",
      "L019",
      "L020",
    ]);
    for (const rule of rules) expect(rule.description).not.toBe("");
  });

  it("collects the issues of every rule", () => {
    const input = baseInput();
    input.folderName = "otra-carpeta";
    input.scenario.level = 300;
    const issues = lintScenario(input);
    expect(issues.map((issue) => `${issue.code} ${issue.severity}`)).toEqual([
      "L001 error",
      "L009 warning",
    ]);
    expect(hasErrors(issues)).toBe(true);
    expect(hasErrors(issues.filter((issue) => issue.severity === "warning"))).toBe(false);
  });

  it("accepts a custom rule list", () => {
    const always: Issue = { code: "X001", severity: "warning", message: "x", path: [] };
    expect(
      lintScenario(baseInput(), [{ code: "X001", description: "x", check: () => [always] }]),
    ).toEqual([always]);
  });
});

describe("lintSharedContent", () => {
  it("returns no issues for the base fixture", () => {
    expect(lintSharedContent(baseSharedInput())).toEqual([]);
  });

  it("registers each rule once, in code order", () => {
    const codes = sharedRules.map((rule) => rule.code);
    expect(codes).toEqual([
      "C001",
      "C002",
      "C003",
      "C004",
      "C005",
      "C006",
      "C007",
      "C008",
      "C009",
      "C010",
      "C011",
      "C012",
      "C013",
    ]);
    for (const rule of sharedRules) expect(rule.description).not.toBe("");
  });

  it("collects the issues of every rule", () => {
    const input = baseSharedInput();
    input.catalog[0]!.category = "storage";
    input.areas.pop();
    const issues = lintSharedContent(input);
    expect(issues.map((issue) => `${issue.code} ${issue.path.join(".")}`)).toEqual([
      "C001 catalog.0.category",
      "C006 badges.2.rule.area",
    ]);
  });

  it("accepts a custom rule list", () => {
    const always: Issue = { code: "X001", severity: "warning", message: "x", path: [] };
    expect(
      lintSharedContent(baseSharedInput(), [
        { code: "X001", description: "x", check: () => [always] },
      ]),
    ).toEqual([always]);
  });
});

const parseRaw = <T>(raw: string, parse: (input: unknown) => ParseResult<T>): T => {
  const parsed = parse(parseYaml(raw));
  if (!parsed.success) throw new Error(formatIssues(parsed.issues));
  return parsed.data;
};

describe("real content", () => {
  it("finds no integrity issues between the shared files", () => {
    const issues = lintSharedContent({
      catalog: parseRaw(servicesRaw, parseServices),
      categories: parseRaw(categoriesRaw, parseCategories),
      confusionGroups: parseRaw(confusionGroupsRaw, parseConfusionGroups),
      areas: parseRaw(areasRaw, parseAreas),
      gameRules: parseRaw(gameRulesRaw, parseGameRules),
      badges: parseRaw(badgesRaw, parseBadges),
    });
    expect(issues).toEqual([]);
  });

  it("finds no issues in serverless-pdf-processing", () => {
    const issues = lintScenario({
      scenario: parseRaw(pdfRaw, parseScenario),
      folderName: "serverless-pdf-processing",
      catalog: pdfCatalog,
      confusionGroups: pdfConfusionGroups,
      gameRules,
      areas: parseRaw(areasRaw, parseAreas),
    });
    expect(issues).toEqual([]);
  });
});
