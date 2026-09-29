// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { NODE_SIZE, type Diagram } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import {
  flowId,
  layoutDiagram,
  orderGroups,
  toFlowEdges,
  toFlowNodes,
  Z,
  type SlotFlowNode,
} from "./flow-model";
import { circleHitsBox, groupLabelBox, nodeBox, STEP_CLEARANCE, STEP_RADIUS } from "./geometry";
import { fakeServices, pdfScenario, realScenarios } from "./testing/fixtures";

const diagram: Diagram = {
  canvas: { width: 1000, height: 600 },
  groups: [
    // Child listed before its parent on purpose.
    {
      id: "vpc",
      kind: "vpc",
      label: "VPC",
      rect: { x: 100, y: 80, w: 500, h: 400 },
      parent: "cloud",
    },
    { id: "cloud", kind: "aws-cloud", label: "Nube", rect: { x: 50, y: 40, w: 900, h: 520 } },
  ],
  nodes: [
    { id: "user", type: "actor", label: "Usuario", icon: "user", position: { x: 0, y: 200 } },
    {
      id: "logs",
      type: "fixed",
      service: "cloudwatch",
      position: { x: 700, y: 100 },
      group: "cloud",
    },
    {
      id: "store",
      type: "slot",
      role: "Guarda los archivos.",
      position: { x: 200, y: 200 },
      group: "vpc",
      answers: [
        { service: "s3", grade: "optimal", objectives: ["o"], rationale: "r", references: [] },
      ],
      incorrect: [],
      hints: ["a", "b"],
    },
  ],
  edges: [
    { id: "e1", from: "user", to: "store", step: 1, label: "Sube", style: "sync" },
    { id: "e2", from: "store", to: "logs", step: 2, label: "Registra", style: "control" },
  ],
};

describe("orderGroups", () => {
  it("puts parents before children, with their nesting depth", () => {
    expect(orderGroups(diagram.groups).map(({ group, depth }) => [group.id, depth])).toEqual([
      ["cloud", 0],
      ["vpc", 1],
    ]);
  });

  it("treats a missing parent or a cycle as a root (L018 reports them)", () => {
    const groups = [
      { ...diagram.groups[0]!, id: "a", parent: "b" },
      { ...diagram.groups[0]!, id: "b", parent: "a" },
      { ...diagram.groups[0]!, id: "c", parent: "missing" },
    ];
    expect(() => orderGroups(groups)).not.toThrow();
    expect(orderGroups(groups).find((g) => g.group.id === "c")?.depth).toBe(0);
  });
});

describe("toFlowNodes", () => {
  const nodes = toFlowNodes(diagram, { services: fakeServices });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  it("maps groups to parent nodes and nodes to their own type, parents first", () => {
    expect(nodes.map((n) => [n.id, n.type])).toEqual([
      ["group:cloud", "group"],
      ["group:vpc", "group"],
      ["node:user", "actor"],
      ["node:logs", "fixed"],
      ["node:store", "slot"],
    ]);
  });

  it("keeps the YAML geometry: child positions relative to the parent group", () => {
    expect(byId.get("group:cloud")).toMatchObject({
      position: { x: 50, y: 40 },
      width: 900,
      height: 520,
    });
    expect(byId.get("group:vpc")).toMatchObject({
      parentId: "group:cloud",
      position: { x: 50, y: 40 },
    });
    expect(byId.get("node:store")).toMatchObject({
      parentId: "group:vpc",
      position: { x: 100, y: 120 },
      width: NODE_SIZE.slot.w,
      height: NODE_SIZE.slot.h,
    });
    expect(byId.get("node:user")).toMatchObject({ position: { x: 0, y: 200 } });
    expect(byId.get("node:user")?.parentId).toBeUndefined();
  });

  it("layers groups under nodes and makes nothing draggable or selectable", () => {
    for (const node of nodes) {
      expect(node).toMatchObject({ draggable: false, selectable: false, focusable: false });
      expect(node.zIndex).toBe(
        node.type === "group" ? Z.group + (node.id === "group:vpc" ? 1 : 0) : Z.node,
      );
    }
  });

  it("draws a slot without state as empty with the hints of the scenario", () => {
    const slot = byId.get("node:store") as SlotFlowNode;
    expect(slot.data.view).toEqual({ grade: "empty", hints: { used: 0, total: 2 } });
    expect(slot.data.service).toBeUndefined();
  });

  it("passes the slot state and resolves the placed service and the fixed service", () => {
    const withState = toFlowNodes(diagram, {
      services: fakeServices,
      slots: { store: { grade: "optimal", serviceId: "s3", selected: true } },
    });
    const slot = withState.find((n) => n.id === "node:store") as SlotFlowNode;
    expect(slot.data.view).toMatchObject({ grade: "optimal", serviceId: "s3", selected: true });
    expect(slot.data.view.hints).toEqual({ used: 0, total: 2 });
    expect(slot.data.service?.name).toBe("Servicio s3");
    expect(withState.find((n) => n.id === "node:logs")?.data).toMatchObject({
      service: { name: "Servicio cloudwatch" },
    });
  });
});

describe("toFlowEdges", () => {
  const layout = layoutDiagram(diagram);

  it("connects the namespaced nodes and carries the clipped segment and the step circle", () => {
    const [e1] = toFlowEdges(diagram, layout, null);
    expect(e1).toMatchObject({
      id: flowId.edge("e1"),
      type: "step",
      source: "node:user",
      target: "node:store",
      zIndex: Z.edge,
      data: { state: "idle" },
    });
    // user (0,200)-(120,280) → store (200,200)-(360,360): ends on both borders.
    expect(e1?.data?.segment.start.x).toBe(120);
    expect(e1?.data?.segment.end.x).toBe(200);
  });

  it("highlights the edges of the current step and dims the rest", () => {
    expect(toFlowEdges(diagram, layout, 2).map((e) => e.data?.state)).toEqual(["dimmed", "active"]);
  });
});

describe("real scenarios", () => {
  it.each(realScenarios.map((s) => [s.id, s] as const))(
    "%s: every step circle sits on its edge, off every node and group label",
    (_id, scenario) => {
      const { diagram: d } = scenario;
      const layout = layoutDiagram(d);
      const obstacles = [...d.nodes.map(nodeBox), ...d.groups.map(groupLabelBox)];
      expect(layout.labels.size).toBe(d.edges.length);
      for (const edge of d.edges) {
        const placement = layout.labels.get(edge.id)!;
        expect(placement.free, `${edge.id} has no free position`).toBe(true);
        for (const box of obstacles) {
          expect(circleHitsBox(placement.point, STEP_RADIUS, box, STEP_CLEARANCE)).toBe(false);
        }
      }
    },
  );

  it("maps every node and group of a scenario", () => {
    const nodes = toFlowNodes(pdfScenario.diagram, { services: fakeServices });
    expect(nodes).toHaveLength(
      pdfScenario.diagram.groups.length + pdfScenario.diagram.nodes.length,
    );
  });
});
