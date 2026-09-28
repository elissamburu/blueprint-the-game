// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l010 } from "./l010-deprecated-services.js";

describe("L010 deprecated services", () => {
  it("passes when no deprecated service is used", () => {
    expect(runRule(l010)).toEqual([]);
  });

  it("fails when a deprecated service is optimal", () => {
    const issues = runRule(l010, (scenario) => {
      slotById(scenario, "store").answers[0]!.service = "simpledb";
    });
    expect(issues).toEqual([
      {
        code: "L010",
        severity: "error",
        message:
          "Amazon SimpleDB está deprecated en el catálogo: no puede ser una respuesta optimal.",
        path: ["diagram", "nodes", 1, "answers", 0, "service"],
      },
    ]);
  });

  it("warns for any other use", () => {
    const issues = runRule(l010, (scenario) => {
      slotById(scenario, "thumbnailer").answers[1]!.service = "simpledb";
      slotById(scenario, "store").incorrect[0]!.service = "simpledb";
      scenario.palette = { mode: "auto", extra: ["simpledb"] };
    });
    expect(issues.map((issue) => [issue.severity, issue.path])).toEqual([
      ["warning", ["diagram", "nodes", 1, "incorrect", 0, "service"]],
      ["warning", ["diagram", "nodes", 2, "answers", 1, "service"]],
      ["warning", ["palette", "extra", 0]],
    ]);
    expect(issues[0]?.message).toBe(
      "Amazon SimpleDB está deprecated en el catálogo (usado como incorrect): revisá si sigue teniendo sentido en el escenario.",
    );
  });
});
