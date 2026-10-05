// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Model of the visual editor of the Studio (RF-STU-04, ADR-0025 §2): the commands the editor emits
// and the pure geometry behind them. The editor draws a draft of the diagram (parseDiagramDraft of
// scenario-schema) and names its elements by id; it never sees the YAML. The Studio turns each
// command into document edits, the same ones the form makes (ADR-0008's pattern applied to the
// Studio). Positions are absolute canvas units, as in the YAML.
import {
  GROUP_KINDS,
  NODE_SIZE,
  type DiagramDraft,
  type DraftGroup,
  type DraftNode,
  type GroupKind,
  type NodeType,
} from "@blueprint/scenario-schema";
import type { Box, Point } from "./geometry";

export type ElementKind = "group" | "node" | "edge";

/** The element the editor has selected (and focused), named by its id. */
export interface DiagramSelection {
  kind: ElementKind;
  id: string;
}

/** Where a node or a group ends up, with its group (node) or parent (group); null: none. */
export type Placement =
  | { kind: "node"; id: string; position: Point; group: string | null }
  | { kind: "group"; id: string; rect: Box; parent: string | null };

export type StepDirection = -1 | 1;

export type DiagramCommand =
  /**
   * Nodes and groups moved or resized, as one edit. `pointer`: one drop, one undo step;
   * `keyboard`: one press of an arrow, joined with the next presses in the undo history.
   */
  | { type: "place"; placements: Placement[]; input: "pointer" | "keyboard" }
  | { type: "addNode"; nodeType: NodeType; position: Point; group: string | null }
  | { type: "addGroup"; kind: GroupKind; rect: Box; parent: string | null }
  | { type: "connect"; from: string; to: string }
  /** A request: the app confirms it (it knows what else goes with the element). */
  | { type: "remove"; target: DiagramSelection }
  | { type: "moveStep"; edgeId: string; direction: StepDirection };

/** Grid of the pointer: a dropped node or group snaps to it, so the YAML keeps round numbers. */
export const GRID = 10;
/** Arrow keys move or resize by 10 canvas units; with Shift, by 1. */
export const NUDGE = { step: 10, fine: 1 } as const;
/** Size of a new group. */
export const NEW_GROUP_SIZE = { w: 400, h: 300 } as const;
/** Smallest group the editor makes when resizing. */
export const MIN_GROUP_SIZE = { w: 40, h: 40 } as const;

export const snap = (value: number): number => Math.round(value / GRID) * GRID;

export const selectionKey = (selection: DiagramSelection): string =>
  `${selection.kind}:${selection.id}`;

export const sameSelection = (
  a: DiagramSelection | null | undefined,
  b: DiagramSelection | null | undefined,
): boolean => (a ?? null) === (b ?? null) || (a?.kind === b?.kind && a?.id === b?.id);

export const draftNodeBox = (node: Pick<DraftNode, "type" | "position">): Box => ({
  ...node.position,
  ...NODE_SIZE[node.type],
});

/** `inner` lies entirely inside `outer` (sharing the border counts as inside). */
export const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

/** Nesting depth of each group through its `parent` (0: top level; cycles stop the count). */
export const groupDepths = (groups: readonly DraftGroup[]): Map<string, number> => {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const depths = new Map<string, number>();
  for (const group of groups) {
    let depth = 0;
    const seen = new Set([group.id]);
    let parent = group.parent == null ? undefined : byId.get(group.parent);
    while (parent !== undefined && !seen.has(parent.id)) {
      seen.add(parent.id);
      depth++;
      parent = parent.parent == null ? undefined : byId.get(parent.parent);
    }
    depths.set(group.id, depth);
  }
  return depths;
};

/**
 * The group a box belongs to after a move: its current group while the box is still entirely
 * inside it; otherwise the innermost group that contains it entirely, or none. So a move never
 * breaks a membership on purpose (a `generic` group across subnets), and leaving a group or
 * landing in another one changes it.
 */
export const containerOf = (
  box: Box,
  groups: readonly DraftGroup[],
  current: string | null | undefined,
  exclude: ReadonlySet<string> = new Set(),
): string | null => {
  const kept = groups.find((group) => group.id === current && !exclude.has(group.id));
  if (kept !== undefined && contains(kept.rect, box)) return kept.id;
  const depths = groupDepths(groups);
  let best: DraftGroup | undefined;
  for (const group of groups) {
    if (exclude.has(group.id) || !contains(group.rect, box)) continue;
    if (best === undefined) {
      best = group;
      continue;
    }
    // The deepest group; between two at the same depth, the smaller one.
    const deeper = (depths.get(group.id) ?? 0) - (depths.get(best.id) ?? 0);
    if (deeper > 0 || (deeper === 0 && area(group.rect) < area(best.rect))) best = group;
  }
  return best?.id ?? null;
};

const area = (box: Box): number => box.w * box.h;

/** The groups nested in a group, at any depth, and the nodes in any of them (or in it). */
export const descendantsOf = (
  draft: Pick<DiagramDraft, "groups" | "nodes">,
  groupId: string,
): { groups: DraftGroup[]; nodes: DraftNode[] } => {
  const inside = new Set([groupId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const group of draft.groups) {
      if (!inside.has(group.id) && group.parent != null && inside.has(group.parent)) {
        inside.add(group.id);
        grew = true;
      }
    }
  }
  return {
    groups: draft.groups.filter((group) => group.id !== groupId && inside.has(group.id)),
    nodes: draft.nodes.filter((node) => node.group !== undefined && inside.has(node.group)),
  };
};

/** A node moved to `position`, with the group it belongs to there. */
export const placeNode = (
  draft: Pick<DiagramDraft, "groups" | "nodes">,
  id: string,
  position: Point,
): Placement[] => {
  const node = draft.nodes.find((candidate) => candidate.id === id);
  if (node === undefined) return [];
  const box = draftNodeBox({ type: node.type, position });
  return [{ kind: "node", id, position, group: containerOf(box, draft.groups, node.group) }];
};

/**
 * A group moved or resized to `rect`, with its parent there. Moving it moves what is inside it
 * (their memberships stay); resizing it leaves them where they are.
 */
export const placeGroup = (
  draft: Pick<DiagramDraft, "groups" | "nodes">,
  id: string,
  rect: Box,
): Placement[] => {
  const group = draft.groups.find((candidate) => candidate.id === id);
  if (group === undefined) return [];
  const inner = descendantsOf(draft, id);
  const exclude = new Set([id, ...inner.groups.map((child) => child.id)]);
  const parent = containerOf(rect, draft.groups, group.parent, exclude);
  const dx = rect.x - group.rect.x;
  const dy = rect.y - group.rect.y;
  const moved = dx !== 0 || dy !== 0;
  return [
    { kind: "group", id, rect, parent },
    ...(moved
      ? [
          ...inner.groups.map((child): Placement => ({
            kind: "group",
            id: child.id,
            rect: { ...child.rect, x: child.rect.x + dx, y: child.rect.y + dy },
            parent: child.parent ?? null,
          })),
          ...inner.nodes.map((node): Placement => ({
            kind: "node",
            id: node.id,
            position: { x: node.position.x + dx, y: node.position.y + dy },
            group: node.group ?? null,
          })),
        ]
      : []),
  ];
};

/**
 * An arrow press on the selection: moves a node or a group by (dx, dy), or with `resize` changes
 * the width and height of a group (never below MIN_GROUP_SIZE). Nothing for edges.
 */
export const nudge = (
  draft: Pick<DiagramDraft, "groups" | "nodes">,
  selection: DiagramSelection,
  dx: number,
  dy: number,
  resize = false,
): Placement[] => {
  if (selection.kind === "node") {
    const node = draft.nodes.find((candidate) => candidate.id === selection.id);
    if (node === undefined || resize) return [];
    return placeNode(draft, node.id, { x: node.position.x + dx, y: node.position.y + dy });
  }
  if (selection.kind !== "group") return [];
  const group = draft.groups.find((candidate) => candidate.id === selection.id);
  if (group === undefined) return [];
  const { rect } = group;
  if (!resize) return placeGroup(draft, group.id, { ...rect, x: rect.x + dx, y: rect.y + dy });
  const w = Math.max(MIN_GROUP_SIZE.w, rect.w + dx);
  const h = Math.max(MIN_GROUP_SIZE.h, rect.h + dy);
  return w === rect.w && h === rect.h ? [] : placeGroup(draft, group.id, { ...rect, w, h });
};

/** Top-left corner of a new node of `type` centered on `point`, on the grid. */
export const newNodePosition = (type: NodeType, point: Point): Point => ({
  x: snap(point.x - NODE_SIZE[type].w / 2),
  y: snap(point.y - NODE_SIZE[type].h / 2),
});

/** Box of a new group centered on `point`, on the grid. */
export const newGroupRect = (point: Point): Box => ({
  x: snap(point.x - NEW_GROUP_SIZE.w / 2),
  y: snap(point.y - NEW_GROUP_SIZE.h / 2),
  ...NEW_GROUP_SIZE,
});

export const addNodeCommand = (
  draft: Pick<DiagramDraft, "groups">,
  nodeType: NodeType,
  center: Point,
): DiagramCommand => {
  const position = newNodePosition(nodeType, center);
  const box = draftNodeBox({ type: nodeType, position });
  return { type: "addNode", nodeType, position, group: containerOf(box, draft.groups, null) };
};

export const addGroupCommand = (
  draft: Pick<DiagramDraft, "groups">,
  kind: GroupKind,
  center: Point,
): DiagramCommand => {
  const rect = newGroupRect(center);
  return { type: "addGroup", kind, rect, parent: containerOf(rect, draft.groups, null) };
};

/**
 * Order of Tab inside the canvas: groups and nodes by their top-left corner (top to bottom, then
 * left to right; a group before what it holds), then the edges by step, in file order.
 */
export const readingOrder = (draft: DiagramDraft): DiagramSelection[] => {
  const boxes = [
    ...draft.groups.map((group) => ({ kind: "group" as const, id: group.id, at: group.rect })),
    ...draft.nodes.map((node) => ({ kind: "node" as const, id: node.id, at: node.position })),
  ].sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x || (a.kind === "group" ? -1 : 1));
  const edges = draft.edges
    .map((edge, index) => ({ edge, index }))
    .sort((a, b) => (a.edge.step ?? Infinity) - (b.edge.step ?? Infinity) || a.index - b.index);
  return [
    ...boxes.map(({ kind, id }) => ({ kind, id })),
    ...edges.map(({ edge }) => ({ kind: "edge" as const, id: edge.id })),
  ];
};

/** Whether the selection names an element of the draft. */
export const hasElement = (draft: DiagramDraft, selection: DiagramSelection): boolean => {
  const list =
    selection.kind === "group"
      ? draft.groups
      : selection.kind === "node"
        ? draft.nodes
        : draft.edges;
  return list.some((element) => element.id === selection.id);
};

// --- Names ---------------------------------------------------------------------------------------

export const NODE_TYPE_NAMES: Record<NodeType, string> = {
  actor: "Actor",
  external: "Sistema externo",
  fixed: "Servicio fijo",
  slot: "Casillero",
};

export const GROUP_KIND_NAMES: Record<GroupKind, string> = {
  "aws-cloud": "Nube de AWS",
  region: "Región",
  vpc: "VPC",
  az: "Zona de disponibilidad",
  "subnet-public": "Subred pública",
  "subnet-private": "Subred privada",
  account: "Cuenta",
  "on-premises": "On-premises",
  generic: "Genérico",
};

export const isGroupKind = (value: string | undefined): value is GroupKind =>
  (GROUP_KINDS as readonly (string | undefined)[]).includes(value);

/** Kind of a group as the editor draws it: an unknown kind is drawn as `generic`. */
export const drawnKind = (group: Pick<DraftGroup, "kind">): GroupKind =>
  isGroupKind(group.kind) ? group.kind : "generic";
