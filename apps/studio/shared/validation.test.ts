// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The validation of the browser gives the same findings as pnpm content:validate (same code,
// severity, message and path) on every scenario, as they are and broken on purpose, over a
// temporary copy of content/. L012 and L014 are left out: they do not run in the Studio.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validate } from "@blueprint/tools-content";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createContentStore } from "../server/content-store.js";
import { nodeFs } from "../server/fs.js";
import { createWorkspace, realScenarioIds, type Workspace } from "../server/testing/workspace.js";
import type { SharedContent } from "./api.js";
import { FIXTURE_SCENARIO_IDS } from "./testing/fixture-scenarios.js";
import { describePath, validateScenarioText } from "./validation.js";

let workspace: Workspace;
let shared: SharedContent;
let ids: string[];

beforeAll(async () => {
  workspace = await createWorkspace();
  shared = await createContentStore({ fs: nodeFs, contentDir: workspace.contentDir }).readShared();
  ids = await realScenarioIds();
});
afterAll(async () => {
  await workspace.dispose();
});

const comparable = (
  findings: { code: string; severity: string; message: string; where?: string }[],
) =>
  findings
    .filter((f) => f.code !== "L012" && f.code !== "L014")
    .map((f) => ({ code: f.code, severity: f.severity, message: f.message, where: f.where ?? "" }));

const VARIANTS: Record<string, (text: string, id: string) => string> = {
  "as it is": (text) => text,
  "with a YAML syntax error": (text) => {
    const lines = text.split("\n");
    lines.splice(3, 0, "title: [sin cerrar");
    return lines.join("\n");
  },
  "failing the schema": (text) =>
    text
      .replace(/^level: \d+$/m, "level: 250")
      .replace(/^version: /m, "campoDesconocido: 1\nversion: "),
  "with lint errors": (text, id) =>
    text
      .replace(`id: ${id}`, `id: ${id}-otro`)
      .replace(/^title: (.*)$/m, (_line, title: string) => `title: ${title} con Amazon S3`),
};

describe("validateScenarioText", () => {
  it("validates every scenario of content/", () => {
    expect(ids).toEqual(expect.arrayContaining([...FIXTURE_SCENARIO_IDS]));
  });

  it.each(Object.keys(VARIANTS))(
    "gives the same findings as content:validate on every scenario %s",
    async (variant) => {
      const mutate = VARIANTS[variant];
      if (mutate === undefined) throw new Error(variant);
      let total = 0;
      for (const id of ids) {
        const file = workspace.scenarioFile(id);
        const original = await readFile(file, "utf8");
        const text = mutate(original, id);
        await writeFile(file, text, "utf8");
        try {
          const report = await validate({ contentDir: workspace.contentDir, id });
          const expected = comparable(report.scenarios[0]?.findings ?? []);
          const actual = comparable(validateScenarioText(text, id, shared).findings);
          expect(actual, `${id} ${variant}`).toEqual(expected);
          total += expected.length;
        } finally {
          await writeFile(file, original, "utf8");
        }
      }
      if (variant !== "as it is") expect(total).toBeGreaterThanOrEqual(ids.length);
    },
  );

  it("points each finding to its line in scenario.yaml", async () => {
    const id = "static-website-https";
    const text = await readFile(workspace.scenarioFile(id), "utf8");
    const lines = text.split("\n");
    const lineOf = (prefix: string) => lines.findIndex((line) => line.startsWith(prefix)) + 1;

    const schema = validateScenarioText(text.replace(/^level: \d+$/m, "level: 250"), id, shared);
    expect(schema.stage).toBe("schema");
    expect(schema.findings[0]).toMatchObject({ code: "SCHEMA", line: lineOf("level:"), column: 1 });

    const lint = validateScenarioText(text.replace(`id: ${id}`, "id: otro-id"), id, shared);
    expect(lint.stage).toBe("lint");
    expect(lint.findings.find((f) => f.code === "L001")).toMatchObject({ line: lineOf("id:") });

    const broken = [...lines];
    broken.splice(5, 0, "title: [sin cerrar");
    const yaml = validateScenarioText(broken.join("\n"), id, shared);
    expect(yaml.stage).toBe("yaml");
    expect(yaml.findings[0]?.line).toBeGreaterThanOrEqual(6);
  });

  it("points a missing field to its parent and a nested one to its key", () => {
    const text = [
      "schemaVersion: 1",
      "id: abc",
      "diagram:",
      "  nodes:",
      "    - id: a",
      "      type: slot",
      "      role: hola",
      "",
    ].join("\n");
    const result = validateScenarioText(text, "abc", shared);
    const role = result.findings.find((f) => f.where.startsWith("diagram.nodes[0]"));
    expect(role?.line).toBeGreaterThanOrEqual(5);
    const missingTitle = result.findings.find((f) => f.where === "title");
    expect(missingTitle?.line).toBe(1);
  });

  it("describes paths with ids like content:validate", () => {
    const doc = { diagram: { nodes: [{ id: "a" }, { id: "b", role: "x" }] } };
    expect(describePath(doc, ["diagram", "nodes", 1, "role"])).toBe("diagram.nodes[1] (b).role");
    expect(describePath(doc, [])).toBe("(raíz)");
  });
});

describe("the copy of content/", () => {
  it("is a temporary folder, never the real content/", () => {
    expect(path.relative(workspace.root, workspace.contentDir)).toBe("content");
    expect(workspace.root.startsWith(path.resolve("."))).toBe(false);
  });
});
