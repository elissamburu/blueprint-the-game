// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c009 } from "./c009-deprecated-in-confusion-group.js";

describe("C009 deprecated services in confusion groups", () => {
  it("passes when no group includes a deprecated service", () => {
    expect(runSharedRule(c009)).toEqual([]);
  });

  it("warns for a deprecated service in a group", () => {
    const issues = runSharedRule(c009, (input) => {
      input.confusionGroups.push({ id: "nosql", services: ["dynamodb", "simpledb"] });
    });
    expect(issues).toEqual([
      {
        code: "C009",
        severity: "warning",
        message:
          'El grupo de confusión "nosql" incluye "simpledb", que está deprecated: la paleta no lo ofrece como distractor; revisá si el grupo sigue teniendo sentido.',
        path: ["confusionGroups", 1, "services", 1],
      },
    ]);
  });
});
