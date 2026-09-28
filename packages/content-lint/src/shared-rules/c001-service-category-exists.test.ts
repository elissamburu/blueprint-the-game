// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c001 } from "./c001-service-category-exists.js";

describe("C001 service categories exist", () => {
  it("passes when every category exists", () => {
    expect(runSharedRule(c001)).toEqual([]);
  });

  it("fails for a service with an unknown category", () => {
    const issues = runSharedRule(c001, (input) => {
      input.catalog[1]!.category = "storage";
    });
    expect(issues).toEqual([
      {
        code: "C001",
        severity: "error",
        message:
          'El servicio "efs" tiene la categoría "storage", que no existe en catalog/categories.yaml.',
        path: ["catalog", 1, "category"],
      },
    ]);
  });
});
