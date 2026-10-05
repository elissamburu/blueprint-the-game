// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scenario `diagram` block → React Flow nodes and edges (ADR-0005). Positions are the YAML ones:
// no layout at runtime. Pure: the React components only read what this module computes.
import type {
  ActorNode,
  Diagram,
  DiagramNode,
  Edge as DiagramEdge,
  ExternalNode,
  FixedNode,
  Group,
  SlotNode,
} from "@blueprint/scenario-schema";
import type { Edge, Node } from "@xyflow/react";
import type { SlotMotion } from "./slot-motion";
import {
  edgeSegment,
  groupLabelBox,
  nodeBox,
  placeStepLabels,
  type Box,
  type Point,
  type Segment,
} from "./geometry";
import type { ServiceInfo, ServiceLookup, SlotView } from "./types";

/**
 * Layers (ReactFlow zIndexMode="manual"): groups at the back by nesting depth, then the edges, their
 * step circles (StepMarkers) and the nodes. Edges go over the group backgrounds and under the
 * nodes; a step circle goes over its edge and under any node.
 */
export const Z = { group: 0, edge: 100, step: 150, node: 200 } as const;

/** React Flow ids are namespaced: a group and a node may share a YAML id. */
export const flowId = {
  group: (id: string) => `group:${id}`,
  node: (id: string) => `node:${id}`,
  edge: (id: string) => `edge:${id}`,
};

export type GroupNodeData = { group: Group };
export type ActorNodeData = { node: ActorNode | ExternalNode };
export type FixedNodeData = { node: FixedNode; service: ServiceInfo | undefined };
export type SlotNodeData = {
  node: SlotNode;
  view: SlotView;
  service: ServiceInfo | undefined;
  box: Box;
  /** A change of the slot to animate (slot-motion.ts). */
  motion?: SlotMotion | undefined;
};

export type GroupFlowNode = Node<GroupNodeData, "group">;
export type ActorFlowNode = Node<ActorNodeData, "actor" | "external">;
export type FixedFlowNode = Node<FixedNodeData, "fixed">;
export type SlotFlowNode = Node<SlotNodeData, "slot">;
export type FlowNode = GroupFlowNode | ActorFlowNode | FixedFlowNode | SlotFlowNode;

export type StepEdgeState = "idle" | "active" | "dimmed";
export type StepEdgeData = {
  edge: DiagramEdge;
  segment: Segment;
  label: Point;
  state: StepEdgeState;
};
export type StepFlowEdge = Edge<StepEdgeData, "step">;

/** Geometry that depends only on the diagram: computed once per scenario. */
export interface DiagramLayout {
  segments: ReadonlyMap<string, Segment>;
  labels: ReadonlyMap<string, { point: Point; free: boolean }>;
}

/** What the layout reads of a diagram: the game passes a Diagram, the Studio editor a draft. */
export interface LayoutInput {
  groups: readonly Pick<Group, "label" | "rect">[];
  nodes: readonly Pick<DiagramNode, "id" | "type" | "position">[];
  edges: readonly Pick<DiagramEdge, "id" | "from" | "to" | "step">[];
}

/**
 * `groupLabelSize`: font size of the group labels when it is not the one of the board (the
 * printed diagram), so the step circles keep clear of the bigger labels.
 */
export const layoutDiagram = (diagram: LayoutInput, groupLabelSize?: number) => {
  const boxes = new Map(diagram.nodes.map((node) => [node.id, nodeBox(node)]));
  const segments = new Map<string, Segment>();
  for (const edge of diagram.edges) {
    const source = boxes.get(edge.from);
    const target = boxes.get(edge.to);
    if (source === undefined || target === undefined) continue; // L006 reports it
    const segment = edgeSegment(source, target);
    if (segment !== null) segments.set(edge.id, segment);
  }
  const obstacles = [
    ...boxes.values(),
    ...diagram.groups.map((group) => groupLabelBox(group, groupLabelSize)),
  ];
  // Steps in flow order, so earlier steps keep the middle of their edge.
  const requests = [...diagram.edges]
    .sort((a, b) => a.step - b.step)
    .flatMap((edge) => {
      const segment = segments.get(edge.id);
      return segment === undefined ? [] : [{ id: edge.id, segment }];
    });
  return { segments, labels: placeStepLabels(requests, obstacles) } satisfies DiagramLayout;
};

/** Groups ordered parents first, as React Flow needs, with their nesting depth. */
export const orderGroups = (groups: readonly Group[]): { group: Group; depth: number }[] => {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const depthOf = (group: Group, seen = new Set<string>()): number => {
    const parent = group.parent == null ? undefined : byId.get(group.parent);
    if (parent === undefined || seen.has(group.id)) return 0; // missing parent or cycle: L018
    seen.add(group.id);
    return depthOf(parent, seen) + 1;
  };
  return groups
    .map((group, index) => ({ group, depth: depthOf(group), index }))
    .sort((a, b) => a.depth - b.depth || a.index - b.index)
    .map(({ group, depth }) => ({ group, depth }));
};

export interface NodeStateInput {
  slots?: Readonly<Record<string, SlotView>> | undefined;
  services: ServiceLookup;
  /** Motions to play, by slot id (only on the board). */
  motions?: Readonly<Record<string, SlotMotion>> | undefined;
}

const emptyView = (node: SlotNode): SlotView => ({
  grade: "empty",
  hints: { used: 0, total: node.hints.length },
});

/** Position relative to the parent group, as React Flow wants for child nodes. */
const relative = (point: Point, parent: Group | undefined): Point =>
  parent === undefined ? point : { x: point.x - parent.rect.x, y: point.y - parent.rect.y };

export const toFlowNodes = (
  diagram: Pick<Diagram, "groups" | "nodes">,
  { slots, services, motions }: NodeStateInput,
): FlowNode[] => {
  const groupsById = new Map(diagram.groups.map((g) => [g.id, g]));
  const fixed = { draggable: false, selectable: false, focusable: false, connectable: false };

  const groupNodes = orderGroups(diagram.groups).map(({ group, depth }): GroupFlowNode => {
    const parent = group.parent == null ? undefined : groupsById.get(group.parent);
    return {
      ...fixed,
      id: flowId.group(group.id),
      type: "group",
      position: relative(group.rect, parent),
      ...(parent === undefined ? {} : { parentId: flowId.group(parent.id) }),
      width: group.rect.w,
      height: group.rect.h,
      zIndex: Z.group + depth,
      data: { group },
    };
  });

  const leafNodes = diagram.nodes.map((node: DiagramNode): FlowNode => {
    const parent = node.group === undefined ? undefined : groupsById.get(node.group);
    const box = nodeBox(node);
    const base = {
      ...fixed,
      id: flowId.node(node.id),
      position: relative(node.position, parent),
      ...(parent === undefined ? {} : { parentId: flowId.group(parent.id) }),
      width: box.w,
      height: box.h,
      zIndex: Z.node,
    };
    switch (node.type) {
      case "actor":
      case "external":
        return { ...base, type: node.type, data: { node } };
      case "fixed":
        return { ...base, type: "fixed", data: { node, service: services(node.service) } };
      case "slot": {
        const view = slots?.[node.id] ?? emptyView(node);
        const serviceId = view.serviceId ?? undefined;
        return {
          ...base,
          type: "slot",
          data: {
            node,
            view: { ...view, hints: view.hints ?? emptyView(node).hints },
            service: serviceId === undefined ? undefined : services(serviceId),
            box,
            motion: motions?.[node.id],
          },
        };
      }
    }
  });

  return [...groupNodes, ...leafNodes];
};

export const toFlowEdges = (
  diagram: Pick<Diagram, "edges">,
  layout: DiagramLayout,
  activeStep: number | null,
): StepFlowEdge[] =>
  diagram.edges.flatMap((edge): StepFlowEdge[] => {
    const segment = layout.segments.get(edge.id);
    const label = layout.labels.get(edge.id);
    if (segment === undefined || label === undefined) return [];
    const state: StepEdgeState =
      activeStep === null ? "idle" : edge.step === activeStep ? "active" : "dimmed";
    return [
      {
        id: flowId.edge(edge.id),
        type: "step",
        source: flowId.node(edge.from),
        target: flowId.node(edge.to),
        selectable: false,
        focusable: false,
        zIndex: Z.edge,
        data: { edge, segment, label: label.point, state },
      },
    ];
  });
