// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The commands of the visual editor as edits of the real 200 scenario: only the scalars that change
// are touched, the rest of the file stays byte for byte, and the result is what the form makes.
import type { DiagramCommand } from "@blueprint/diagram/editor";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { pdfYaml } from "../testing/content-fixture";
import { EditError, planEdits } from "../../shared/document-edit";
import { indexOf, translate } from "./diagram-commands";

type Raw = {
  diagram: {
    groups: Record<string, unknown>[];
    nodes: Record<string, unknown>[];
    edges: Record<string, unknown>[];
  };
};

const raw = parseDocument(pdfYaml).toJS() as Raw;

const apply = (command: DiagramCommand, text = pdfYaml) => {
  const before = parseDocument(text).toJS() as Raw;
  const translation = translate(before, command);
  const result = planEdits(text, translation.commands);
  return { ...translation, text: result.text, after: parseDocument(result.text).toJS() as Raw };
};

const node = (data: Raw, id: string) => data.diagram.nodes.find((item) => item.id === id);
const lines = (text: string) => text.split("\n");
/** Lines of `after` that differ from `before` (same number of lines). */
const changedLines = (before: string, after: string) =>
  lines(after).filter((line, index) => line !== lines(before)[index]);

describe("translate: place", () => {
  it("sets only the coordinates that change, as one line of the file", () => {
    const result = apply({
      type: "place",
      input: "keyboard",
      placements: [{ kind: "node", id: "api-entry", position: { x: 310, y: 160 }, group: "cloud" }],
    });
    expect(result.isolate).toBe(false);
    expect(result.commands).toEqual([
      { op: "set", path: ["diagram", "nodes", 2, "position", "x"], value: 310 },
    ]);
    expect(changedLines(pdfYaml, result.text)).toEqual(["      position: { x: 310, y: 160 }"]);
  });

  it("changes the group of a node that leaves it, removing the key when it has none", () => {
    const result = apply({
      type: "place",
      input: "pointer",
      placements: [{ kind: "node", id: "logs", position: { x: 20, y: 20 }, group: null }],
    });
    expect(result.isolate).toBe(true);
    expect(node(result.after, "logs")).toEqual({
      id: "logs",
      type: "fixed",
      service: "cloudwatch",
      position: { x: 20, y: 20 },
    });
  });

  it("adds the group of a node that lands in one", () => {
    const result = apply({
      type: "place",
      input: "pointer",
      placements: [{ kind: "node", id: "client", position: { x: 240, y: 472 }, group: "cloud" }],
    });
    expect(node(result.after, "client")).toMatchObject({
      position: { x: 240, y: 472 },
      group: "cloud",
    });
  });

  it("moves a group with what is inside it in one edit, writing `parent: null` for none", () => {
    const text =
      "diagram:\n  groups:\n    - id: a\n      rect: { x: 0, y: 0, w: 100, h: 100 }\n" +
      "    - id: b\n      rect: { x: 10, y: 10, w: 50, h: 50 }\n      parent: a\n" +
      "  nodes:\n    - id: n\n      type: actor\n      position: { x: 20, y: 20 }\n      group: b\n";
    const result = apply(
      {
        type: "place",
        input: "pointer",
        placements: [
          { kind: "group", id: "b", rect: { x: 200, y: 10, w: 50, h: 50 }, parent: null },
          { kind: "node", id: "n", position: { x: 210, y: 20 }, group: "b" },
        ],
      },
      text,
    );
    expect(result.after.diagram.groups[1]).toEqual({
      id: "b",
      rect: { x: 200, y: 10, w: 50, h: 50 },
      parent: null,
    });
    expect(result.after.diagram.nodes[0]).toMatchObject({
      position: { x: 210, y: 20 },
      group: "b",
    });
  });

  it("does nothing when nothing changes", () => {
    const { commands } = translate(raw, {
      type: "place",
      input: "pointer",
      placements: [
        { kind: "group", id: "cloud", rect: { x: 200, y: 60, w: 1160, h: 700 }, parent: null },
      ],
    });
    expect(commands).toEqual([]);
  });

  it("refuses an element that is no longer in the document", () => {
    expect(() =>
      translate(raw, {
        type: "place",
        input: "pointer",
        placements: [{ kind: "node", id: "nope", position: { x: 0, y: 0 }, group: null }],
      }),
    ).toThrow(EditError);
  });
});

describe("translate: new elements", () => {
  it("appends a node with a free id where it was dropped, and selects it", () => {
    const result = apply({
      type: "addNode",
      nodeType: "slot",
      position: { x: 400, y: 300 },
      group: "cloud",
    });
    expect(result.select).toEqual({ kind: "node", id: "nuevo-slot" });
    expect(result.after.diagram.nodes.at(-1)).toEqual({
      id: "nuevo-slot",
      type: "slot",
      role: "",
      answers: [],
      position: { x: 400, y: 300 },
      group: "cloud",
    });
    // The text before the diagram is untouched.
    expect(result.text.startsWith(pdfYaml.slice(0, pdfYaml.indexOf("  nodes:")))).toBe(true);
  });

  it("appends a group, inside its parent", () => {
    const result = apply({
      type: "addGroup",
      kind: "vpc",
      rect: { x: 300, y: 100, w: 400, h: 300 },
      parent: "cloud",
    });
    expect(result.after.diagram.groups.at(-1)).toEqual({
      id: "nuevo-grupo",
      kind: "vpc",
      label: "",
      rect: { x: 300, y: 100, w: 400, h: 300 },
      parent: "cloud",
    });
    expect(result.select).toEqual({ kind: "group", id: "nuevo-grupo" });
  });

  it("connects two nodes with an edge last in the flow", () => {
    const last = Math.max(...raw.diagram.edges.map((edge) => Number(edge.step)));
    const result = apply({ type: "connect", from: "client", to: "logs" });
    expect(result.after.diagram.edges.at(-1)).toEqual({
      id: "nueva-arista",
      from: "client",
      to: "logs",
      step: last + 1,
      label: "",
      style: "sync",
    });
    expect(result.select).toEqual({ kind: "edge", id: "nueva-arista" });
  });
});

describe("translate: remove and steps", () => {
  it("removes a node with its edges, and an edge alone", () => {
    const edges = raw.diagram.edges.filter(
      (edge) => edge.from === "api-entry" || edge.to === "api-entry",
    ).length;
    const withNode = apply({ type: "remove", target: { kind: "node", id: "api-entry" } });
    expect(node(withNode.after, "api-entry")).toBeUndefined();
    expect(withNode.after.diagram.edges).toHaveLength(raw.diagram.edges.length - edges);

    const edge = raw.diagram.edges[0];
    const alone = apply({ type: "remove", target: { kind: "edge", id: String(edge?.id) } });
    expect(alone.after.diagram.edges).toHaveLength(raw.diagram.edges.length - 1);
    expect(alone.after.diagram.nodes).toHaveLength(raw.diagram.nodes.length);
  });

  it("removes a group, leaving its nodes without a group", () => {
    const result = apply({ type: "remove", target: { kind: "group", id: "cloud" } });
    expect(result.after.diagram.groups).toEqual([]);
    expect(result.after.diagram.nodes.some((item) => "group" in item)).toBe(false);
  });

  it("moves an edge one step, and does nothing where it cannot move", () => {
    const text =
      "diagram:\n  edges:\n    - { id: a, from: x, to: y, step: 1 }\n" +
      "    - { id: b, from: y, to: z, step: 2 }\n";
    const later = apply({ type: "moveStep", edgeId: "a", direction: 1 }, text);
    expect(later.after.diagram.edges.map((edge) => edge.step)).toEqual([1, 1]);
    expect(later.step).toBe(1);
    const before = parseDocument(text).toJS() as unknown;
    expect(translate(before, { type: "moveStep", edgeId: "a", direction: -1 }).commands).toEqual(
      [],
    );
  });

  it("finds elements by id in their list", () => {
    expect(indexOf(raw, { kind: "node", id: "logs" })).toBe(1);
    expect(indexOf(raw, { kind: "group", id: "cloud" })).toBe(0);
    expect(indexOf(raw, { kind: "edge", id: "nope" })).toBe(-1);
  });
});
