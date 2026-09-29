// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  loadContentBundle,
  loadScenario,
  type ContentLoadError,
  type LoadOptions,
  type LoadResult,
} from "./load-bundle";
import { BASE_URL, bundleFiles, fetchFrom } from "./testing/bundle-fixture";

const options = (files: Record<string, unknown>, includeDrafts = false): LoadOptions => ({
  baseUrl: BASE_URL,
  fetch: fetchFrom(files),
  includeDrafts,
});

const errorOf = <T>(result: LoadResult<T>): ContentLoadError => {
  if (result.ok) throw new Error("Expected a load error");
  return result.error;
};

const valueOf = <T>(result: LoadResult<T>): T => {
  if (!result.ok) throw new Error(JSON.stringify(result.error, null, 2));
  return result.value;
};

describe("loadContentBundle", () => {
  it("loads and validates a valid bundle", async () => {
    const bundle = valueOf(await loadContentBundle(options(bundleFiles())));
    expect(bundle.index.areas.length).toBeGreaterThan(0);
    expect(bundle.catalog.services.some((s) => s.id === "lambda")).toBe(true);
    expect(bundle.rules.ranks[0]?.name).toBe("Aprendiz");
  });

  it("lists published and beta scenarios but not drafts in production", async () => {
    const bundle = valueOf(await loadContentBundle(options(bundleFiles())));
    expect(bundle.index.scenarios.map((s) => [s.id, s.status])).toEqual([
      ["static-website-https", "published"],
      ["serverless-pdf-processing", "beta"],
    ]);
  });

  it("lists drafts too when includeDrafts is on (pnpm dev:web)", async () => {
    const bundle = valueOf(await loadContentBundle(options(bundleFiles(), true)));
    expect(bundle.index.scenarios.map((s) => s.status)).toEqual(["published", "beta", "draft"]);
  });

  it("never lists retired scenarios, even with includeDrafts", async () => {
    const files = bundleFiles(["retired", "published", "draft"]);
    const bundle = valueOf(await loadContentBundle(options(files, true)));
    expect(bundle.index.scenarios.map((s) => s.id)).not.toContain("static-website-https");
  });

  it("reports schema issues with the file name when a file is invalid", async () => {
    const files = bundleFiles();
    const rules = files["game-rules.json"] as Record<string, unknown>;
    files["game-rules.json"] = { ...rules, ranks: [] };
    const error = errorOf(await loadContentBundle(options(files)));
    expect(error).toMatchObject({ kind: "invalid", file: "game-rules.json" });
    expect(error.kind === "invalid" && error.issues.map((i) => i.where)).toEqual(["ranks"]);
  });

  it("rejects an index.json of another bundle format", async () => {
    const files = bundleFiles();
    files["index.json"] = { ...(files["index.json"] as object), schemaVersion: 2 };
    expect(errorOf(await loadContentBundle(options(files)))).toMatchObject({
      kind: "invalid",
      file: "index.json",
    });
  });

  it("reports a file that is not JSON", async () => {
    const files = { ...bundleFiles(), "catalog.json": "<!doctype html>" };
    expect(errorOf(await loadContentBundle(options(files)))).toEqual({
      kind: "invalid-json",
      file: "catalog.json",
    });
  });

  it("reports a missing file", async () => {
    const { "index.json": _index, ...files } = bundleFiles();
    expect(errorOf(await loadContentBundle(options(files)))).toEqual({
      kind: "network",
      file: "index.json",
      detail: "HTTP 404",
    });
  });

  it("reports a network failure", async () => {
    const failing: typeof fetch = () => Promise.reject(new TypeError("Failed to fetch"));
    const result = await loadContentBundle({ baseUrl: BASE_URL, fetch: failing, includeDrafts: false });
    expect(errorOf(result)).toEqual({
      kind: "network",
      file: "index.json",
      detail: "Failed to fetch",
    });
  });
});

describe("loadScenario", () => {
  const entry = {
    id: "static-website-https",
    version: 1,
    file: "static-website-https.v1.json",
  };

  it("loads and validates a scenario", async () => {
    const scenario = valueOf(await loadScenario(entry, options(bundleFiles())));
    expect(scenario.id).toBe("static-website-https");
    expect(scenario.diagram.nodes.some((node) => node.type === "slot")).toBe(true);
  });

  it("reports an invalid scenario", async () => {
    const files = bundleFiles();
    const scenario = files[entry.file] as Record<string, unknown>;
    files[entry.file] = { ...scenario, level: 150 };
    const error = errorOf(await loadScenario(entry, options(files)));
    expect(error).toMatchObject({ kind: "invalid", file: entry.file });
  });

  it("rejects a file that holds another version", async () => {
    const error = errorOf(await loadScenario({ ...entry, version: 2 }, options(bundleFiles())));
    expect(error).toEqual({
      kind: "mismatch",
      file: entry.file,
      id: entry.id,
      version: 2,
    });
  });
});
