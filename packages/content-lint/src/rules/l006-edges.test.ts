// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l006 } from "./l006-edges.js";

describe("L006 edges", () => {
  it("passes with existing nodes and steps 1..n", () => {
    expect(runRule(l006)).toEqual([]);
  });

  it("allows parallel edges with the same step", () => {
    expect(
      runRule(l006, (scenario) => {
        scenario.diagram.edges[2]!.step = 2;
      }),
    ).toEqual([]);
  });

  it("passes without edges", () => {
    expect(
      runRule(l006, (scenario) => {
        scenario.diagram.edges = [];
      }),
    ).toEqual([]);
  });

  it("reports edges to unknown nodes", () => {
    const issues = runRule(l006, (scenario) => {
      scenario.diagram.edges[0]!.from = "ghost";
      scenario.diagram.edges[0]!.to = "phantom";
    });
    expect(issues).toEqual([
      {
        code: "L006",
        severity: "error",
        message: 'La arista "e1" tiene from: "ghost", que no es un nodo del diagrama.',
        path: ["diagram", "edges", 0, "from"],
      },
      {
        code: "L006",
        severity: "error",
        message: 'La arista "e1" tiene to: "phantom", que no es un nodo del diagrama.',
        path: ["diagram", "edges", 0, "to"],
      },
    ]);
  });

  it("reports gaps in the steps", () => {
    const one = runRule(l006, (scenario) => {
      scenario.diagram.edges[2]!.step = 4;
    });
    expect(one.map((issue) => issue.message)).toEqual([
      "Los pasos de las aristas tienen huecos: falta el paso 3. Tienen que ser consecutivos desde 1.",
    ]);
    const many = runRule(l006, (scenario) => {
      scenario.diagram.edges[0]!.step = 3;
      scenario.diagram.edges[1]!.step = 5;
      scenario.diagram.edges[2]!.step = 5;
    });
    expect(many).toEqual([
      {
        code: "L006",
        severity: "error",
        message:
          "Los pasos de las aristas tienen huecos: faltan los pasos 1, 2, 4. Tienen que ser consecutivos desde 1.",
        path: ["diagram", "edges"],
      },
    ]);
  });
});
