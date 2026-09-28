// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { baseScenario, runRule, slotById } from "../testing/fixtures.js";
import { isOfficialReference, l011 } from "./l011-official-references.js";

describe("L011 optimal answers cite official docs", () => {
  it("passes when every optimal has an official reference", () => {
    expect(runRule(l011)).toEqual([]);
  });

  it("accepts exactly the official hosts", () => {
    expect(isOfficialReference("https://docs.aws.amazon.com/lambda/")).toBe(true);
    expect(isOfficialReference("https://aws.amazon.com/event-driven-architecture/")).toBe(true);
    expect(isOfficialReference("https://AWS.amazon.com")).toBe(true);
    expect(isOfficialReference("https://repost.aws/knowledge-center")).toBe(false);
    expect(isOfficialReference("https://docs.aws.amazon.com.example.com/")).toBe(false);
    expect(isOfficialReference("https://blog.example.com/aws.amazon.com")).toBe(false);
  });

  it("warns for an optimal without official references", () => {
    const issues = runRule(l011, (scenario) => {
      slotById(scenario, "store").answers[0]!.references = ["https://example.com/s3-intro"];
    });
    expect(issues).toEqual([
      {
        code: "L011",
        severity: "warning",
        message:
          'La respuesta optimal "s3" del casillero "store" no tiene referencias a documentación oficial (docs.aws.amazon.com o aws.amazon.com).',
        path: ["diagram", "nodes", 1, "answers", 0, "references"],
      },
    ]);
  });

  it("does not require references on acceptable answers", () => {
    // The base fixture has an acceptable answer (fargate) without references.
    expect(slotById(baseScenario(), "thumbnailer").answers[1]!.references).toEqual([]);
    expect(runRule(l011)).toEqual([]);
  });
});
