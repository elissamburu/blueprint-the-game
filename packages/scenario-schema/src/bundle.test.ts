// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parseBundleCatalog, parseBundleIndex, type ParseResult } from "./index.js";

const messages = <T>(result: ParseResult<T>): string[] =>
  result.success ? [] : result.issues.map((i) => `${i.where}: ${i.message}`);

const entry = {
  id: "static-website-https",
  version: 1,
  status: "beta",
  level: 100,
  areas: ["networking"],
  title: "Un sitio",
  summary: "Un resumen.",
  estimatedMinutes: 8,
  file: "static-website-https.v1.json",
};

const index = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  areas: [{ id: "networking", name: "Redes" }],
  scenarios: [entry],
  ...overrides,
});

describe("parseBundleIndex", () => {
  it("accepts the index written by content:build", () => {
    expect(parseBundleIndex(index()).success).toBe(true);
  });

  it("rejects another format version", () => {
    expect(messages(parseBundleIndex(index({ schemaVersion: 2 })))).toEqual([
      "schemaVersion: schemaVersion tiene que ser 1",
    ]);
  });

  it("rejects an entry whose file is not <id>.v<version>.json", () => {
    const result = parseBundleIndex(index({ scenarios: [{ ...entry, file: "../x.json" }] }));
    expect(messages(result).join("\n")).toContain("file tiene que ser <id>.v<version>.json");
  });

  it("rejects unknown fields in an entry", () => {
    expect(parseBundleIndex(index({ scenarios: [{ ...entry, answers: [] }] })).success).toBe(false);
  });
});

describe("parseBundleCatalog", () => {
  it("requires services, categories and confusion groups", () => {
    expect(parseBundleCatalog({ services: [], categories: [], confusionGroups: [] }).success).toBe(
      true,
    );
    expect(parseBundleCatalog({ services: [] }).success).toBe(false);
  });
});
