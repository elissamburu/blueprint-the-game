// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c005 } from "./c005-unique-ids.js";

describe("C005 unique ids in shared files", () => {
  it("passes when ids are unique in every file", () => {
    expect(runSharedRule(c005)).toEqual([]);
  });

  it("reports repeated ids in each file", () => {
    const issues = runSharedRule(c005, (input) => {
      input.catalog.push({ ...input.catalog[0]! });
      input.categories[1]!.id = "test";
      input.confusionGroups.push({ id: "compute", services: ["s3", "efs"] });
      input.areas[1]!.id = "serverless";
      input.badges[3]!.id = "primer-verde";
      input.gameRules.ranks[1]!.id = "aprendiz";
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ["catalog", 9, "id"],
      ["categories", 1, "id"],
      ["confusionGroups", 1, "id"],
      ["areas", 1, "id"],
      ["badges", 3, "id"],
      ["gameRules", "ranks", 1, "id"],
    ]);
    expect(issues[0]).toEqual({
      code: "C005",
      severity: "error",
      message: 'El id "s3" está repetido en catalog/services.yaml: cada id tiene que ser único.',
      path: ["catalog", 9, "id"],
    });
    expect(issues[5]?.message).toBe(
      'El id "aprendiz" está repetido en los rangos de game-rules.yaml: cada id tiene que ser único.',
    );
  });
});
