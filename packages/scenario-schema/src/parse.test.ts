// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml, stringify } from "yaml";
import exampleRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import { isUnparsableDraft, isUnparsableDraftDocument } from "./index.js";

/** The published example as YAML text, with some top-level fields replaced. */
const scenarioText = (fields: Record<string, unknown>): string =>
  stringify({ ...(parseYaml(exampleRaw) as Record<string, unknown>), ...fields });

describe("isUnparsableDraft", () => {
  it("skips a draft that does not pass the schema", () => {
    expect(isUnparsableDraft(scenarioText({ status: "draft", title: "" }), parseYaml)).toBe(true);
  });

  it("does not skip a beta that does not pass the schema: it still fails", () => {
    expect(isUnparsableDraft(scenarioText({ status: "beta", title: "" }), parseYaml)).toBe(false);
  });

  it("does not skip a valid draft: it is processed as any scenario", () => {
    expect(isUnparsableDraft(scenarioText({ status: "draft" }), parseYaml)).toBe(false);
  });

  it("does not skip invalid YAML, even if it says draft: it still fails", () => {
    expect(isUnparsableDraft("status: draft\ntitle: [sin cerrar\n", parseYaml)).toBe(false);
  });

  it("only looks at objects", () => {
    for (const document of [null, undefined, "draft", ["status", "draft"]]) {
      expect(isUnparsableDraftDocument(document)).toBe(false);
    }
  });
});
