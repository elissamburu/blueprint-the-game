// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c002 } from "./c002-adjacent-categories.js";

describe("C002 adjacent categories", () => {
  it("passes when adjacent categories exist and are not the category itself", () => {
    expect(runSharedRule(c002)).toEqual([]);
  });

  it("fails for an unknown adjacent category", () => {
    const issues = runSharedRule(c002, (input) => {
      input.categories[1]!.adjacent = ["test", "storage"];
    });
    expect(issues).toEqual([
      {
        code: "C002",
        severity: "error",
        message:
          'La categoría "other" tiene como adyacente a "storage", que no existe en catalog/categories.yaml.',
        path: ["categories", 1, "adjacent", 1],
      },
    ]);
  });

  it("fails for a category adjacent to itself", () => {
    const issues = runSharedRule(c002, (input) => {
      input.categories[0]!.adjacent = ["test"];
    });
    expect(issues).toEqual([
      {
        code: "C002",
        severity: "error",
        message:
          'La categoría "test" se lista como adyacente a sí misma: adjacent solo nombra otras categorías.',
        path: ["categories", 0, "adjacent", 0],
      },
    ]);
  });
});
