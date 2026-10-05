// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Ordenar" (RF-STU-05, ADR-0025 §2): the auto-layout of a diagram with elkjs (ADR-0005). A subpath
// of its own (`@blueprint/diagram/layout`) without React, so the game never loads it and the AI
// pipeline of F5 can run it in Node. It only computes geometry: the positions of the nodes, the
// rects of the groups and the canvas. Ids, texts, membership, edges and steps are read, never
// changed; the caller decides how to write the result.
//
// Layered left to right, with the groups as compound nodes (hierarchy included in one pass), the
// node sizes of the content contract (NODE_SIZE), room at the top of each group for its label
// chip, and the order of the flow (the steps of the edges) as the model order. The coordinates are
// absolute, on the grid of the editor and with a margin around the content.
import ELK, {
  type ElkExtendedEdge,
  type ElkNode,
  type LayoutOptions,
} from "elkjs/lib/elk.bundled.js";
import { NODE_SIZE, type NodeType } from "@blueprint/scenario-schema";
import { GRID, snap } from "./editor-model";
import { GROUP_LABEL, type Box, type Point } from "./geometry";

/** What the layout reads of a group: a `Group` of the schema and a `DraftGroup` both fit. */
export interface LayoutGroup {
  id: string;
  label?: string | undefined;
  rect: Box;
  parent?: string | null | undefined;
}

export interface LayoutNode {
  id: string;
  type: NodeType;
  group?: string | undefined;
}

export interface LayoutEdge {
  from: string;
  to: string;
  step?: number | undefined;
}

/** The `diagram` block of a scenario, or the draft the editor of the Studio draws. */
export interface LayoutInput {
  groups: readonly LayoutGroup[];
  nodes: readonly LayoutNode[];
  edges: readonly LayoutEdge[];
}

export interface LayoutResult {
  /** Top-left corner of each node, by id (absolute canvas units, as in the YAML). */
  positions: ReadonlyMap<string, Point>;
  /** Rect of each group, by id. */
  rects: ReadonlyMap<string, Box>;
  canvas: { width: number; height: number };
}

/** Free space around the content, up to the border of the canvas. */
export const LAYOUT_MARGIN = 40;

/**
 * Padding inside a group. The top one leaves the label chip (GROUP_LABEL) clear of the nodes.
 * Every gap is at least twice the grid: rounding each border to the grid moves it half a grid at
 * most, so no node can end up outside its group or over another one.
 */
export const GROUP_PADDING = { top: 50, left: 30, bottom: 30, right: 30 } as const;

const ROOT_OPTIONS: LayoutOptions = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  // The flow reads in the order of its steps: nodes and edges go to ELK sorted by step.
  "elk.layered.considerModelOrder.strategy": "NODES_AND_EDGES",
  "elk.spacing.nodeNode": "40",
  // Room for the step circle on every edge between two columns.
  "elk.layered.spacing.nodeNodeBetweenLayers": "80",
  "elk.spacing.componentComponent": "60",
  "elk.padding": "[top=0,left=0,bottom=0,right=0]",
};

const GROUP_OPTIONS: LayoutOptions = {
  "elk.padding": `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.left},bottom=${GROUP_PADDING.bottom},right=${GROUP_PADDING.right}]`,
  "elk.nodeSize.constraints": "MINIMUM_SIZE",
};

/** Smallest group that shows its whole label chip, on the grid. */
const minimumGroupSize = (group: LayoutGroup) => {
  const chip = (group.label ?? "").length * GROUP_LABEL.charWidth + GROUP_LABEL.padding;
  const w = Math.ceil((chip + 2 * GROUP_LABEL.offsetX) / GRID) * GRID;
  return {
    w: Math.max(w, GROUP_PADDING.left + GROUP_PADDING.right),
    h: GROUP_PADDING.top + GROUP_PADDING.bottom,
  };
};

const firstOfEachId = <T extends { id: string }>(items: readonly T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};

/**
 * The parent of each group that the layout can honour: a missing parent, or one in a cycle
 * (possible in a draft), leaves the group at the top level.
 */
const effectiveParents = (groups: readonly LayoutGroup[]): Map<string, string | null> => {
  const declared = new Map(groups.map((group) => [group.id, group.parent ?? null]));
  const inCycle = (id: string): boolean => {
    const seen = new Set<string>();
    for (let current = declared.get(id) ?? null; current !== null;) {
      if (current === id) return true;
      if (seen.has(current)) return false;
      seen.add(current);
      current = declared.get(current) ?? null;
    }
    return false;
  };
  return new Map(
    groups.map((group) => {
      const parent = declared.get(group.id) ?? null;
      const valid = parent !== null && declared.has(parent) && !inCycle(group.id);
      return [group.id, valid ? parent : null];
    }),
  );
};

/** The groups from the container of a node (or a group) up to the top level, innermost first. */
const chainOf = (start: string | null, parents: ReadonlyMap<string, string | null>): string[] => {
  const chain: string[] = [];
  for (let current = start; current !== null && !chain.includes(current);) {
    chain.push(current);
    current = parents.get(current) ?? null;
  }
  return chain;
};

const groupKey = (id: string) => `g:${id}`;
const nodeKey = (id: string) => `n:${id}`;

let elk: InstanceType<typeof ELK> | undefined;

/** Lays the diagram out. Deterministic: the same diagram always gives the same result. */
export const autoLayout = async (diagram: LayoutInput): Promise<LayoutResult> => {
  const groups = firstOfEachId(diagram.groups);
  const nodes = firstOfEachId(diagram.nodes);
  const parents = effectiveParents(groups);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const containerOf = (node: LayoutNode): string | null =>
    node.group !== undefined && parents.has(node.group) ? node.group : null;

  // Model order: edges by step (then as written), nodes by the first step they take part in.
  const edges = diagram.edges
    .map((edge, index) => ({ edge, index }))
    .filter(({ edge }) => edge.from !== edge.to && nodeIds.has(edge.from) && nodeIds.has(edge.to))
    .sort((a, b) => (a.edge.step ?? Infinity) - (b.edge.step ?? Infinity) || a.index - b.index)
    .map(({ edge }) => edge);
  const firstStep = new Map<string, number>();
  edges.forEach((edge, order) => {
    for (const id of [edge.from, edge.to]) if (!firstStep.has(id)) firstStep.set(id, order);
  });
  const orderedNodes = nodes
    .map((node, index) => ({ node, index }))
    .sort(
      (a, b) =>
        (firstStep.get(a.node.id) ?? Infinity) - (firstStep.get(b.node.id) ?? Infinity) ||
        a.index - b.index,
    )
    .map(({ node }) => node);

  // The ELK graph: groups as compound nodes, every element under its container.
  const root: ElkNode = { id: "root", layoutOptions: ROOT_OPTIONS, children: [], edges: [] };
  const compounds = new Map<string, ElkNode>();
  const nodeOrder = new Map(orderedNodes.map((node, order) => [node.id, order]));
  /** A group goes where its first node (in model order) goes; empty groups last. */
  const groupOrder = (id: string): number =>
    Math.min(
      Infinity,
      ...orderedNodes
        .filter((node) => chainOf(containerOf(node), parents).includes(id))
        .map((node) => nodeOrder.get(node.id) ?? Infinity),
    );
  const orderedGroups = groups
    .map((group, index) => ({ group, index, order: groupOrder(group.id) }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .map(({ group }) => group);
  const filled = new Set([...nodes.map(containerOf), ...parents.values()]);
  for (const group of orderedGroups) {
    const minimum = minimumGroupSize(group);
    compounds.set(group.id, {
      id: groupKey(group.id),
      children: [],
      edges: [],
      // A group with content takes the size of its content; an empty one keeps its own size.
      ...(filled.has(group.id)
        ? {
            layoutOptions: {
              ...GROUP_OPTIONS,
              "elk.nodeSize.minimum": `(${minimum.w},${minimum.h})`,
            },
          }
        : {
            width: Math.ceil(Math.max(group.rect.w, minimum.w) / GRID) * GRID,
            height: Math.ceil(Math.max(group.rect.h, minimum.h) / GRID) * GRID,
          }),
    });
  }
  const parentNode = (container: string | null): ElkNode =>
    container === null ? root : (compounds.get(container) ?? root);
  // Children in model order: nodes and groups of one container interleaved by their order.
  const children: { container: string | null; order: number; element: ElkNode }[] = [];
  for (const group of orderedGroups) {
    const element = compounds.get(group.id);
    if (element !== undefined) {
      children.push({
        container: parents.get(group.id) ?? null,
        order: groupOrder(group.id),
        element,
      });
    }
  }
  for (const node of orderedNodes) {
    const size = NODE_SIZE[node.type];
    children.push({
      container: containerOf(node),
      order: nodeOrder.get(node.id) ?? Infinity,
      element: { id: nodeKey(node.id), width: size.w, height: size.h },
    });
  }
  children
    .map((child, index) => ({ ...child, index }))
    .sort((a, b) => a.order - b.order || a.index - b.index)
    .forEach(({ container, element }) => parentNode(container).children?.push(element));

  // Each edge in the innermost group that holds both ends (ELK's containment rule).
  const byId = new Map(nodes.map((node) => [node.id, node]));
  edges.forEach((edge, index) => {
    const from = chainOf(containerOf(byId.get(edge.from) as LayoutNode), parents);
    const to = new Set(chainOf(containerOf(byId.get(edge.to) as LayoutNode), parents));
    const common = from.find((id) => to.has(id)) ?? null;
    const elkEdge: ElkExtendedEdge = {
      id: `e${index}`,
      sources: [nodeKey(edge.from)],
      targets: [nodeKey(edge.to)],
    };
    parentNode(common).edges?.push(elkEdge);
  });

  elk ??= new ELK();
  const laid = await elk.layout(root);

  // Absolute coordinates, every border rounded to the grid on its own.
  const positions = new Map<string, Point>();
  const rects = new Map<string, Box>();
  const walk = (element: ElkNode, offset: Point) => {
    for (const child of element.children ?? []) {
      const x = offset.x + (child.x ?? 0);
      const y = offset.y + (child.y ?? 0);
      if (child.id.startsWith("n:")) {
        positions.set(child.id.slice(2), { x: snap(x), y: snap(y) });
      } else {
        const left = snap(x);
        const top = snap(y);
        rects.set(child.id.slice(2), {
          x: left,
          y: top,
          w: snap(x + (child.width ?? 0)) - left,
          h: snap(y + (child.height ?? 0)) - top,
        });
        walk(child, { x, y });
      }
    }
  };
  walk(laid, { x: 0, y: 0 });

  // The content starts at the margin, and the canvas ends at the margin after it.
  const boxes = [
    ...[...positions].map(([id, point]) => ({
      ...point,
      ...NODE_SIZE[(byId.get(id) as LayoutNode).type],
    })),
    ...rects.values(),
  ];
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const dx = boxes.length === 0 ? 0 : LAYOUT_MARGIN - minX;
  const dy = boxes.length === 0 ? 0 : LAYOUT_MARGIN - minY;
  for (const [id, point] of positions) positions.set(id, { x: point.x + dx, y: point.y + dy });
  for (const [id, rect] of rects) rects.set(id, { ...rect, x: rect.x + dx, y: rect.y + dy });
  const right = Math.max(LAYOUT_MARGIN, ...boxes.map((box) => box.x + box.w + dx));
  const bottom = Math.max(LAYOUT_MARGIN, ...boxes.map((box) => box.y + box.h + dy));
  return {
    positions,
    rects,
    canvas: { width: right + LAYOUT_MARGIN, height: bottom + LAYOUT_MARGIN },
  };
};

export interface GroupOverlap {
  /** The two sibling groups (same parent), in the order of the diagram. */
  first: string;
  second: string;
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Sibling groups that overlap now (lint L007 warns about them; it may be on purpose, e.g. a
 * transversal group). The layout always separates them, so the Studio asks first.
 */
export const overlappingSiblingGroups = (diagram: Pick<LayoutInput, "groups">): GroupOverlap[] => {
  const groups = firstOfEachId(diagram.groups);
  return groups.flatMap((group, i) =>
    groups
      .slice(0, i)
      .filter(
        (other) =>
          (other.parent ?? null) === (group.parent ?? null) && overlaps(other.rect, group.rect),
      )
      .map((other) => ({ first: other.id, second: group.id })),
  );
};
