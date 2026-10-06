// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { scenarioJsonSchema } from "./index.js";

/** Finds the first value stored under `key` anywhere in a JSON value. */
const find = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) return undefined;
  if (key in value) return (value as Record<string, unknown>)[key];
  for (const child of Object.values(value)) {
    const found = find(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
};

describe("scenarioJsonSchema", () => {
  it("documents analogyLimit for editor autocompletion", () => {
    expect(find(scenarioJsonSchema(), "analogyLimit")).toMatchObject({
      type: "object",
      required: ["text", "references"],
      additionalProperties: false,
      properties: {
        text: { maxLength: 300 },
        references: {
          minItems: 1,
          description: "≥ 1, documentación oficial (docs.aws.amazon.com o aws.amazon.com).",
        },
      },
    });
  });
});
