// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import exampleRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import { parseDiagramDraft } from "./index.js";

type Json = Record<string, unknown>;

const exampleDiagram = (): Json => (parseYaml(exampleRaw) as Json)["diagram"] as Json;

describe("parseDiagramDraft", () => {
  it("reads every element of a valid diagram as complete", () => {
    const diagram = exampleDiagram();
    const draft = parseDiagramDraft(diagram);
    expect(draft.skipped).toBe(0);
    expect(draft.canvas).toEqual(diagram["canvas"]);
    expect(draft.nodes).toHaveLength((diagram["nodes"] as unknown[]).length);
    expect(draft.groups).toHaveLength((diagram["groups"] as unknown[]).length);
    expect(draft.edges).toHaveLength((diagram["edges"] as unknown[]).length);
    expect([...draft.nodes, ...draft.groups, ...draft.edges].every((e) => !e.incomplete)).toBe(
      true,
    );
  });

  it("draws elements that the full schema rejects, marked as incomplete", () => {
    const draft = parseDiagramDraft({
      nodes: [
        { id: "nuevo-slot", type: "slot", role: "", answers: [], position: { x: 40, y: 40 } },
        { id: "nuevo-actor", type: "actor", label: "", icon: "user", position: { x: 0, y: 0 } },
      ],
      groups: [{ id: "g", kind: "rara", label: "", rect: { x: 0, y: 0, w: 10, h: 10 } }],
      edges: [{ id: "e", from: "a", to: "b", step: 1, label: "", style: "sync" }],
    });
    expect(draft.skipped).toBe(0);
    expect(draft.nodes.map((n) => [n.id, n.incomplete])).toEqual([
      ["nuevo-slot", true],
      ["nuevo-actor", true],
    ]);
    expect(draft.groups[0]).toMatchObject({ id: "g", kind: "rara", incomplete: true });
    expect(draft.edges[0]).toMatchObject({ id: "e", incomplete: true });
  });

  it("drops a field of the wrong type instead of the element", () => {
    const draft = parseDiagramDraft({
      nodes: [{ id: "a", type: "actor", label: 7, group: ["x"], position: { x: 1, y: 2 } }],
      edges: [{ id: "e", from: "a", to: "a", step: "dos" }],
      groups: [{ id: "g", rect: { x: 0, y: 0, w: 10, h: 10 }, parent: 3 }],
    });
    expect(draft.nodes[0]).toMatchObject({ id: "a", label: undefined, group: undefined });
    expect(draft.edges[0]).toMatchObject({ id: "e", step: undefined });
    expect(draft.groups[0]).toMatchObject({ id: "g", parent: undefined });
    expect(draft.groups[0]?.kind).toBeUndefined();
  });

  it("skips elements without a valid geometry and repeated ids", () => {
    const draft = parseDiagramDraft({
      canvas: { width: 0, height: 10 },
      nodes: [
        { id: "a", type: "actor", position: { x: 0, y: 0 } },
        { id: "a", type: "fixed", position: { x: 9, y: 9 } },
        { id: "b", type: "cloud", position: { x: 0, y: 0 } },
        { id: "c", type: "slot" },
        { id: "", type: "slot", position: { x: 0, y: 0 } },
        "texto",
      ],
      groups: [{ id: "g", rect: { x: 0, y: 0, w: 0, h: 10 } }],
      edges: [{ id: "e", from: "a" }],
    });
    expect(draft.nodes.map((n) => n.id)).toEqual(["a"]);
    expect(draft.nodes[0]?.type).toBe("actor");
    expect(draft.groups).toEqual([]);
    expect(draft.edges).toEqual([]);
    expect(draft.skipped).toBe(7);
    expect(draft.canvas).toBeUndefined();
  });

  it("reads anything that is not a diagram as an empty draft", () => {
    for (const value of [undefined, null, 3, "x", []]) {
      expect(parseDiagramDraft(value)).toEqual({
        canvas: undefined,
        groups: [],
        nodes: [],
        edges: [],
        skipped: 0,
      });
    }
  });
});
