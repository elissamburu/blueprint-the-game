// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { formatIssues, parseScenario } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import pdfRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import { hasErrors, lintScenario, rules } from "./index.js";
import { baseInput, gameRules } from "./testing/fixtures.js";
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

describe("lintScenario: real content", () => {
  it("finds no issues in serverless-pdf-processing", () => {
    const parsed = parseScenario(parseYaml(pdfRaw));
    if (!parsed.success) throw new Error(formatIssues(parsed.issues));
    const issues = lintScenario({
      scenario: parsed.data,
      folderName: "serverless-pdf-processing",
      catalog: pdfCatalog,
      confusionGroups: pdfConfusionGroups,
      gameRules,
    });
    expect(issues).toEqual([]);
  });
});
