// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c012 } from "./c012-concept-official-docs.js";

describe("C012 official docs of a concept", () => {
  it("passes when every concept points to docs.aws.amazon.com or aws.amazon.com", () => {
    expect(runSharedRule(c012)).toEqual([]);
    expect(
      runSharedRule(c012, (input) => {
        input.catalog[9]!.docs = "https://aws.amazon.com/about-aws/global-infrastructure/";
      }),
    ).toEqual([]);
  });

  it("fails for a concept with docs outside the official hosts", () => {
    const issues = runSharedRule(c012, (input) => {
      input.catalog[9]!.docs = "https://docs.aws.amazon.com.example.com/region";
    });
    expect(issues).toEqual([
      {
        code: "C012",
        severity: "error",
        message:
          'El docs del concepto "region" (https://docs.aws.amazon.com.example.com/region) no es documentación oficial: un concepto se explica con una fuente oficial en docs.aws.amazon.com o aws.amazon.com.',
        path: ["catalog", 9, "docs"],
      },
    ]);
  });

  it("does not apply to services", () => {
    expect(
      runSharedRule(c012, (input) => {
        input.catalog[0]!.docs = "https://repost.aws/s3";
      }),
    ).toEqual([]);
  });
});
