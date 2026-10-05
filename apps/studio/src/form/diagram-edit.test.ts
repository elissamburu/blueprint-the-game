// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Steps of the edges and removal of nodes and groups (RF-STU-03): the commands of each edit, and
// their result over the real 200 scenario.
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import { pdfYaml } from "../testing/content-fixture";
import {
  canMoveStep,
  edgesOfNode,
  moveStep,
  normalizeSteps,
  removeGroupCommands,
  removeNodeCommands,
  stepCommands,
} from "./diagram-edit";
import { planEdits } from "../../shared/document-edit";

const raw = parseDocument(pdfYaml).toJS() as {
  diagram: {
    nodes: { id: string; group?: string }[];
    edges: { id: string; from: string; to: string; step: number }[];
    groups: { id: string; parent?: string | null }[];
  };
};

describe("steps of the edges", () => {
  it("numbers the steps again without gaps", () => {
    expect(normalizeSteps([3, 1, 3, 7])).toEqual([2, 1, 2, 3]);
  });

  it.each([
    // alone in its step: it joins the neighbor step, in parallel
    [[1, 2, 3], 1, -1, [1, 1, 2]],
    [[1, 2, 3], 1, 1, [1, 2, 2]],
    // sharing its step: it goes alone before or after the others
    [[1, 1, 2], 0, -1, [1, 2, 3]],
    [[1, 2, 2], 2, 1, [1, 2, 3]],
    [[1, 2, 2], 1, -1, [1, 1, 2]],
  ])("%j, edge %i, %i → %j", (steps, index, direction, expected) => {
    expect(moveStep(steps, index, direction as -1 | 1)).toEqual(expected);
  });

  it("cannot move an edge alone in the first step up, nor alone in the last down", () => {
    expect(canMoveStep([1, 2], 0, -1)).toBe(false);
    expect(canMoveStep([1, 2], 1, 1)).toBe(false);
    expect(canMoveStep([1, 1], 0, -1)).toBe(true);
    expect(canMoveStep([1, 1], 1, 1)).toBe(true);
    expect(canMoveStep([1, 2], 5, 1)).toBe(false);
  });

  it("sets only the steps that change, and says which edges go in parallel", () => {
    const first = raw.diagram.edges.findIndex((edge) => edge.step === 2);
    const result = stepCommands(raw, first, -1);
    expect(result.step).toBe(1);
    expect(result.parallel.length).toBeGreaterThan(0);
    const text = planEdits(pdfYaml, result.commands).text;
    const after = parseDocument(text).toJS() as typeof raw;
    expect(after.diagram.edges[first]?.step).toBe(1);
    const steps = after.diagram.edges.map((edge) => edge.step);
    expect(normalizeSteps(steps)).toEqual(steps);
  });
});

describe("removing nodes and groups", () => {
  it("removes a node with its edges, in one edit", () => {
    const index = raw.diagram.nodes.findIndex((node) => node.id === "api-entry");
    const edges = edgesOfNode(raw, index);
    expect(edges.length).toBeGreaterThan(0);
    const text = planEdits(pdfYaml, removeNodeCommands(raw, index)).text;
    const after = parseDocument(text).toJS() as typeof raw;
    expect(after.diagram.nodes.map((node) => node.id)).not.toContain("api-entry");
    expect(
      after.diagram.edges.filter((edge) => edge.from === "api-entry" || edge.to === "api-entry"),
    ).toEqual([]);
    expect(after.diagram.edges).toHaveLength(raw.diagram.edges.length - edges.length);
  });

  it("removes a group, leaving its nodes without a group and its children under its parent", () => {
    const text =
      "diagram:\n  groups:\n    - id: a\n      parent: null\n    - id: b\n      parent: a\n    - id: c\n      parent: b\n" +
      "  nodes:\n    - id: n\n      group: b\n      position: { x: 1, y: 1 }\n";
    const before = parseDocument(text).toJS() as unknown;
    const after = parseDocument(
      planEdits(text, removeGroupCommands(before, 1)).text,
    ).toJS() as unknown;
    expect(after).toEqual({
      diagram: {
        groups: [
          { id: "a", parent: null },
          { id: "c", parent: "a" },
        ],
        nodes: [{ id: "n", position: { x: 1, y: 1 } }],
      },
    });
  });
});
