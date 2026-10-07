// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c011 } from "./c011-entry-category-kind.js";

describe("C011 category kind of each catalog entry", () => {
  it("passes when services and concepts are in categories of their kind", () => {
    expect(runSharedRule(c011)).toEqual([]);
  });

  it("fails for a concept in a service category", () => {
    const issues = runSharedRule(c011, (input) => {
      input.catalog[9]!.category = "test";
    });
    expect(issues).toEqual([
      {
        code: "C011",
        severity: "error",
        message:
          'El concepto "region" está en la categoría "test", que es kind: service: usá una categoría kind: concept.',
        path: ["catalog", 9, "category"],
      },
    ]);
  });

  it("fails for a service in a concept category", () => {
    const issues = runSharedRule(c011, (input) => {
      input.catalog[0]!.category = "concept-test";
    });
    expect(issues).toEqual([
      {
        code: "C011",
        severity: "error",
        message:
          'El servicio "s3" está en la categoría "concept-test", que es kind: concept: usá una categoría kind: service.',
        path: ["catalog", 0, "category"],
      },
    ]);
  });

  it("leaves unknown categories to C001", () => {
    expect(
      runSharedRule(c011, (input) => {
        input.catalog[9]!.category = "missing";
      }),
    ).toEqual([]);
  });
});
