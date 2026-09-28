// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Group } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { nodeById, runRule } from "../testing/fixtures.js";
import { l018 } from "./l018-ids-and-references.js";

const group = (id: string, parent: string | null): Group => ({
  id,
  kind: "generic",
  label: id,
  rect: { x: 210, y: 50, w: 100, h: 100 },
  parent,
});

describe("L018 unique ids and group references", () => {
  it("passes for unique ids and valid group references", () => {
    expect(runRule(l018)).toEqual([]);
  });

  it("reports repeated ids in each collection", () => {
    const issues = runRule(l018, (scenario) => {
      scenario.objectives.push({ ...scenario.objectives[0]! });
      scenario.diagram.groups.push(group("cloud", null));
      nodeById(scenario, "logs").id = "store";
      scenario.diagram.edges[2]!.id = "e1";
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ["objectives", 2, "id"],
      ["diagram", "groups", 1, "id"],
      ["diagram", "nodes", 3, "id"],
      ["diagram", "edges", 2, "id"],
    ]);
    expect(issues[0]).toEqual({
      code: "L018",
      severity: "error",
      message: 'El id "no-servers" está repetido en objectives: cada id tiene que ser único.',
      path: ["objectives", 2, "id"],
    });
  });

  it("reports nodes and groups pointing to missing groups", () => {
    const issues = runRule(l018, (scenario) => {
      nodeById(scenario, "store").group = "vpc";
      scenario.diagram.groups[0]!.parent = "region";
    });
    expect(issues).toEqual([
      {
        code: "L018",
        severity: "error",
        message: 'El nodo "store" referencia el grupo "vpc", que no existe en diagram.groups.',
        path: ["diagram", "nodes", 1, "group"],
      },
      {
        code: "L018",
        severity: "error",
        message: 'El grupo "cloud" referencia el grupo "region", que no existe en diagram.groups.',
        path: ["diagram", "groups", 0, "parent"],
      },
    ]);
  });

  it("accepts nested groups without cycles", () => {
    expect(
      runRule(l018, (scenario) => {
        scenario.diagram.groups.push(group("vpc", "cloud"), group("subnet", "vpc"));
      }),
    ).toEqual([]);
  });

  it("reports each nesting cycle once", () => {
    const issues = runRule(l018, (scenario) => {
      scenario.diagram.groups.push(group("b", "a"), group("a", "b"), group("c", "a"));
    });
    expect(issues).toEqual([
      {
        code: "L018",
        severity: "error",
        message: "Los grupos forman un ciclo de anidamiento: a → b → a.",
        path: ["diagram", "groups", 2, "parent"],
      },
    ]);
  });

  it("reports a group that is its own parent", () => {
    const issues = runRule(l018, (scenario) => {
      scenario.diagram.groups[0]!.parent = "cloud";
    });
    expect(issues.map((issue) => issue.message)).toEqual([
      "Los grupos forman un ciclo de anidamiento: cloud → cloud.",
    ]);
  });
});
