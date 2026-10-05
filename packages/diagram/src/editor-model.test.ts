// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { parseDiagramDraft, type DiagramDraft } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import {
  addGroupCommand,
  addNodeCommand,
  containerOf,
  descendantsOf,
  drawnKind,
  groupDepths,
  hasElement,
  newNodePosition,
  nudge,
  placeGroup,
  placeNode,
  readingOrder,
  sameSelection,
  snap,
} from "./editor-model";
import { pdfScenario } from "./testing/fixtures";

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

/** cloud ⊃ vpc ⊃ subnet, and a `generic` group across the vpc; an actor outside everything. */
const draft: DiagramDraft = parseDiagramDraft({
  canvas: { width: 1200, height: 800 },
  groups: [
    { id: "cloud", kind: "aws-cloud", label: "AWS", rect: rect(200, 0, 900, 700), parent: null },
    { id: "vpc", kind: "vpc", label: "VPC", rect: rect(250, 50, 700, 500), parent: "cloud" },
    {
      id: "subnet",
      kind: "subnet-private",
      label: "Privada",
      rect: rect(300, 100, 400, 300),
      parent: "vpc",
    },
    {
      id: "across",
      kind: "generic",
      label: "Transversal",
      rect: rect(220, 80, 800, 200),
      parent: "cloud",
    },
  ],
  nodes: [
    { id: "user", type: "actor", label: "Usuario", icon: "user", position: { x: 20, y: 300 } },
    { id: "api", type: "fixed", service: "api", position: { x: 320, y: 120 }, group: "subnet" },
    {
      id: "store",
      type: "slot",
      role: "Guarda",
      answers: [],
      position: { x: 800, y: 300 },
      group: "vpc",
    },
  ],
  edges: [
    { id: "e2", from: "api", to: "store", step: 2, label: "b", style: "sync" },
    { id: "e1", from: "user", to: "api", step: 1, label: "a", style: "sync" },
    { id: "e3", from: "user", to: "store", step: 1, label: "c", style: "sync" },
  ],
});

describe("containerOf", () => {
  it("keeps the current group while the box is entirely inside it", () => {
    // Inside subnet, vpc, cloud and across: the current one (across) stays.
    expect(containerOf(rect(320, 120, 160, 80), draft.groups, "across")).toBe("across");
  });

  it("takes the innermost group that contains the box when it leaves its group", () => {
    expect(containerOf(rect(320, 300, 160, 80), draft.groups, "across")).toBe("subnet");
    expect(containerOf(rect(800, 420, 120, 80), draft.groups, null)).toBe("vpc");
    expect(containerOf(rect(220, 600, 120, 80), draft.groups, "vpc")).toBe("cloud");
  });

  it("is none outside every group, or across a border", () => {
    expect(containerOf(rect(20, 300, 120, 80), draft.groups, "cloud")).toBeNull();
    expect(containerOf(rect(180, 300, 120, 80), draft.groups, undefined)).toBeNull();
  });

  it("prefers the smaller of two groups at the same depth, and skips the excluded ones", () => {
    // Inside vpc and across (both depth 1); across is smaller.
    expect(containerOf(rect(800, 100, 120, 80), draft.groups, null)).toBe("across");
    expect(containerOf(rect(800, 100, 120, 80), draft.groups, null, new Set(["across"]))).toBe(
      "vpc",
    );
  });
});

describe("groupDepths", () => {
  it("counts the parents, and stops at a cycle or a missing parent", () => {
    expect(Object.fromEntries(groupDepths(draft.groups))).toEqual({
      cloud: 0,
      vpc: 1,
      subnet: 2,
      across: 1,
    });
    const cyclic = parseDiagramDraft({
      groups: [
        { id: "a", rect: rect(0, 0, 10, 10), parent: "b" },
        { id: "b", rect: rect(0, 0, 10, 10), parent: "a" },
        { id: "c", rect: rect(0, 0, 10, 10), parent: "nope" },
      ],
    }).groups;
    expect(Object.fromEntries(groupDepths(cyclic))).toEqual({ a: 1, b: 1, c: 0 });
  });
});

describe("descendantsOf", () => {
  it("has the nested groups at any depth and the nodes in any of them", () => {
    const vpc = descendantsOf(draft, "vpc");
    expect(vpc.groups.map((g) => g.id)).toEqual(["subnet"]);
    expect(vpc.nodes.map((n) => n.id)).toEqual(["api", "store"]);
    expect(descendantsOf(draft, "cloud").groups.map((g) => g.id)).toEqual([
      "vpc",
      "subnet",
      "across",
    ]);
  });
});

describe("placeNode", () => {
  it("moves a node and keeps its group while it is inside it", () => {
    expect(placeNode(draft, "api", { x: 330, y: 130 })).toEqual([
      { kind: "node", id: "api", position: { x: 330, y: 130 }, group: "subnet" },
    ]);
  });

  it("changes the group when the node leaves it or lands in another one", () => {
    expect(placeNode(draft, "user", { x: 800, y: 420 })).toEqual([
      { kind: "node", id: "user", position: { x: 800, y: 420 }, group: "vpc" },
    ]);
    expect(placeNode(draft, "store", { x: 20, y: 20 })[0]).toMatchObject({ group: null });
  });

  it("is nothing for an unknown node", () => {
    expect(placeNode(draft, "nope", { x: 0, y: 0 })).toEqual([]);
  });
});

describe("placeGroup", () => {
  it("moves the nested groups and nodes with the group, keeping their memberships", () => {
    const placements = placeGroup(draft, "vpc", rect(260, 70, 700, 500));
    expect(placements).toEqual([
      { kind: "group", id: "vpc", rect: rect(260, 70, 700, 500), parent: "cloud" },
      { kind: "group", id: "subnet", rect: rect(310, 120, 400, 300), parent: "vpc" },
      { kind: "node", id: "api", position: { x: 330, y: 140 }, group: "subnet" },
      { kind: "node", id: "store", position: { x: 810, y: 320 }, group: "vpc" },
    ]);
  });

  it("leaves what is inside where it is when only the size changes", () => {
    expect(placeGroup(draft, "vpc", rect(250, 50, 600, 400))).toEqual([
      { kind: "group", id: "vpc", rect: rect(250, 50, 600, 400), parent: "cloud" },
    ]);
  });

  it("never makes a group the parent of itself or of its ancestors' descendants", () => {
    // Moved out of the cloud, the vpc has no parent; its subnet is never a candidate.
    expect(placeGroup(draft, "vpc", rect(0, 0, 100, 100))[0]).toMatchObject({ parent: null });
  });

  it("is nothing for an unknown group", () => {
    expect(placeGroup(draft, "nope", rect(0, 0, 1, 1))).toEqual([]);
  });
});

describe("nudge", () => {
  it("moves a node or a group by the given amount", () => {
    expect(nudge(draft, { kind: "node", id: "api" }, 10, 0)).toEqual([
      { kind: "node", id: "api", position: { x: 330, y: 120 }, group: "subnet" },
    ]);
    expect(nudge(draft, { kind: "group", id: "subnet" }, 0, -1)[0]).toEqual({
      kind: "group",
      id: "subnet",
      rect: rect(300, 99, 400, 300),
      parent: "vpc",
    });
  });

  it("resizes a group, never below the minimum size", () => {
    expect(nudge(draft, { kind: "group", id: "subnet" }, 10, -10, true)).toEqual([
      { kind: "group", id: "subnet", rect: rect(300, 100, 410, 290), parent: "vpc" },
    ]);
    const small = parseDiagramDraft({ groups: [{ id: "g", rect: rect(0, 0, 40, 40) }] });
    expect(nudge(small, { kind: "group", id: "g" }, -10, -10, true)).toEqual([]);
  });

  it("does nothing for edges, for resizing nodes and for unknown elements", () => {
    expect(nudge(draft, { kind: "edge", id: "e1" }, 10, 0)).toEqual([]);
    expect(nudge(draft, { kind: "node", id: "api" }, 10, 0, true)).toEqual([]);
    expect(nudge(draft, { kind: "group", id: "nope" }, 10, 0)).toEqual([]);
  });
});

describe("new elements", () => {
  it("are centered on the point, on the grid, inside the innermost group there", () => {
    expect(snap(14)).toBe(10);
    expect(snap(15)).toBe(20);
    expect(newNodePosition("slot", { x: 504, y: 297 })).toEqual({ x: 420, y: 220 });
    expect(addNodeCommand(draft, "fixed", { x: 500, y: 250 })).toEqual({
      type: "addNode",
      nodeType: "fixed",
      position: { x: 420, y: 210 },
      group: "subnet",
    });
    expect(addGroupCommand(draft, "az", { x: 100, y: 100 })).toEqual({
      type: "addGroup",
      kind: "az",
      rect: rect(-100, -50, 400, 300),
      parent: null,
    });
  });
});

describe("readingOrder", () => {
  it("goes through groups and nodes top to bottom, left to right, then edges by step", () => {
    expect(readingOrder(draft).map((item) => `${item.kind}:${item.id}`)).toEqual([
      "group:cloud",
      "group:vpc",
      "group:across",
      "group:subnet",
      "node:api",
      "node:user",
      "node:store",
      "edge:e1",
      "edge:e3",
      "edge:e2",
    ]);
  });

  it("covers every element of a real scenario once", () => {
    const real = parseDiagramDraft(pdfScenario.diagram);
    const order = readingOrder(real);
    expect(order).toHaveLength(real.groups.length + real.nodes.length + real.edges.length);
    expect(order.every((item) => hasElement(real, item))).toBe(true);
  });
});

describe("helpers", () => {
  it("compare selections and draw unknown kinds as generic", () => {
    expect(sameSelection(null, undefined)).toBe(true);
    expect(sameSelection({ kind: "node", id: "a" }, { kind: "node", id: "a" })).toBe(true);
    expect(sameSelection({ kind: "node", id: "a" }, { kind: "group", id: "a" })).toBe(false);
    expect(sameSelection({ kind: "node", id: "a" }, null)).toBe(false);
    expect(drawnKind({ kind: "vpc" })).toBe("vpc");
    expect(drawnKind({ kind: "rara" })).toBe("generic");
    expect(drawnKind({ kind: undefined })).toBe("generic");
    expect(hasElement(draft, { kind: "edge", id: "nope" })).toBe(false);
  });
});
