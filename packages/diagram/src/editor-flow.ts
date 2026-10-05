// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Draft of the diagram → React Flow nodes and edges of the visual editor, with the name and the
// state of each element. Pure, as flow-model.ts: the components only read what this computes.
// Every element says whether it is incomplete or has issues with an icon and a word, never only
// with a color (docs/accesibilidad.md, 1.4.1).
import type { DiagramDraft, DraftEdge, DraftGroup, DraftNode } from "@blueprint/scenario-schema";
import type { Edge, Node } from "@xyflow/react";
import {
  GROUP_KIND_NAMES,
  NODE_TYPE_NAMES,
  draftNodeBox,
  drawnKind,
  groupDepths,
  selectionKey,
  type DiagramSelection,
} from "./editor-model";
import { flowId, layoutDiagram, Z } from "./flow-model";
import type { Point, Segment } from "./geometry";
import type { ServiceInfo, ServiceLookup } from "./types";

export type IssueLevel = "error" | "warning";

/** Issues of the elements by `selectionKey` (the worst level of each one). */
export type ElementIssues = ReadonlyMap<string, IssueLevel>;

export interface ElementStatus {
  level: IssueLevel | null;
  /** The word next to the icon, and the end of the accessible name. */
  text: string;
}

const OK: ElementStatus = { level: null, text: "" };

export const statusOf = (
  selection: DiagramSelection,
  incomplete: boolean,
  issues: ElementIssues | undefined,
): ElementStatus => {
  const level = issues?.get(selectionKey(selection));
  if (level === "error") return { level, text: "Con errores" };
  if (incomplete) return { level: "warning", text: "Incompleto" };
  if (level === "warning") return { level, text: "Con advertencias" };
  return OK;
};

const NO_NAME = "(sin nombre)";

/** What a node shows: the label of actors, the service of fixed nodes, the role of slots. */
export const nodeTitle = (node: DraftNode, services: ServiceLookup): string => {
  switch (node.type) {
    case "actor":
    case "external":
      return node.label?.trim() || NO_NAME;
    case "fixed":
      return node.service === undefined || node.service === ""
        ? "(sin servicio)"
        : (services(node.service)?.name ?? node.service);
    case "slot":
      return node.role?.trim() || "(sin rol)";
  }
};

export const groupTitle = (group: DraftGroup): string =>
  group.label?.trim() || GROUP_KIND_NAMES[drawnKind(group)];

/** "Casillero 2" for slots (numbered in file order, as the form does), the type for the rest. */
export const nodeTypeName = (node: DraftNode, slotNumber: number | undefined): string =>
  node.type === "slot" && slotNumber !== undefined
    ? `${NODE_TYPE_NAMES.slot} ${slotNumber}`
    : NODE_TYPE_NAMES[node.type];

export type EditorGroupData = {
  group: DraftGroup;
  title: string;
  name: string;
  status: ElementStatus;
  selected: boolean;
};
export type EditorLeafData = {
  node: DraftNode;
  typeName: string;
  title: string;
  name: string;
  status: ElementStatus;
  selected: boolean;
  service: ServiceInfo | undefined;
};
export type EditorEdgeData = {
  edge: DraftEdge;
  segment: Segment;
  label: Point;
  name: string;
  status: ElementStatus;
  selected: boolean;
};

export type EditorGroupNode = Node<EditorGroupData, "editorGroup">;
export type EditorLeafNode = Node<EditorLeafData, "editorLeaf">;
export type EditorFlowNode = EditorGroupNode | EditorLeafNode;
export type EditorFlowEdge = Edge<EditorEdgeData, "editorEdge">;

export interface EditorFlowInput {
  services: ServiceLookup;
  selection: DiagramSelection | null;
  issues?: ElementIssues | undefined;
}

const isSelected = (selection: DiagramSelection | null, candidate: DiagramSelection) =>
  selection?.kind === candidate.kind && selection.id === candidate.id;

const statusSuffix = (status: ElementStatus) => (status.text === "" ? "" : `. ${status.text}`);

/** Names of the nodes (and slot numbers), for nodes, edges and the "Conectar con…" list. */
export const nodeNames = (draft: Pick<DiagramDraft, "nodes">, services: ServiceLookup) => {
  let slots = 0;
  return new Map(
    draft.nodes.map((node) => {
      const number = node.type === "slot" ? ++slots : undefined;
      const typeName = nodeTypeName(node, number);
      return [node.id, { typeName, title: nodeTitle(node, services) }] as const;
    }),
  );
};

export const toEditorNodes = (
  draft: DiagramDraft,
  { services, selection, issues }: EditorFlowInput,
): EditorFlowNode[] => {
  const groupsById = new Map(draft.groups.map((group) => [group.id, group]));
  const depths = groupDepths(draft.groups);
  const names = nodeNames(draft, services);
  const parentOf = (id: string | null | undefined) => (id == null ? undefined : groupsById.get(id));
  const relative = (point: Point, parent: DraftGroup | undefined): Point =>
    parent === undefined ? point : { x: point.x - parent.rect.x, y: point.y - parent.rect.y };

  // React Flow needs parents before their children.
  const ordered = [...draft.groups].sort(
    (a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0),
  );
  const groupNodes = ordered.map((group): EditorGroupNode => {
    const parent = parentOf(group.parent);
    const selectionOf = { kind: "group" as const, id: group.id };
    const status = statusOf(selectionOf, group.incomplete, issues);
    const title = groupTitle(group);
    const { x, y, w, h } = group.rect;
    return {
      id: flowId.group(group.id),
      type: "editorGroup",
      position: relative(group.rect, parent),
      ...(parent === undefined ? {} : { parentId: flowId.group(parent.id) }),
      width: w,
      height: h,
      zIndex: Z.group + (depths.get(group.id) ?? 0),
      // Groups are moved from their label (EditorGroupNode), so the pointer pans from their body.
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        group,
        title,
        name:
          `Grupo ${GROUP_KIND_NAMES[drawnKind(group)]}: ${title}. ` +
          `x ${x}, y ${y}, ancho ${w}, alto ${h}${statusSuffix(status)}`,
        status,
        selected: isSelected(selection, selectionOf),
      },
    };
  });

  const leafNodes = draft.nodes.map((node): EditorLeafNode => {
    const parent = parentOf(node.group);
    const box = draftNodeBox(node);
    const selectionOf = { kind: "node" as const, id: node.id };
    const status = statusOf(selectionOf, node.incomplete, issues);
    const { typeName, title } = names.get(node.id) ?? { typeName: "", title: "" };
    const where = parent === undefined ? "sin grupo" : `en ${groupTitle(parent)}`;
    return {
      id: flowId.node(node.id),
      type: "editorLeaf",
      position: relative(node.position, parent),
      ...(parent === undefined ? {} : { parentId: flowId.group(parent.id) }),
      width: box.w,
      height: box.h,
      zIndex: Z.node,
      selectable: false,
      data: {
        node,
        typeName,
        title,
        name: `${typeName}: ${title}. ${where}, x ${box.x}, y ${box.y}${statusSuffix(status)}`,
        status,
        selected: isSelected(selection, selectionOf),
        service:
          node.type === "fixed" && node.service !== undefined ? services(node.service) : undefined,
      },
    };
  });

  return [...groupNodes, ...leafNodes];
};

export const toEditorEdges = (
  draft: DiagramDraft,
  { services, selection, issues }: EditorFlowInput,
): EditorFlowEdge[] => {
  const layout = layoutDiagram({
    groups: draft.groups.map((group) => ({ label: group.label ?? "", rect: group.rect })),
    nodes: draft.nodes,
    edges: draft.edges.map((edge) => ({ ...edge, step: edge.step ?? Infinity })),
  });
  const names = nodeNames(draft, services);
  return draft.edges.flatMap((edge): EditorFlowEdge[] => {
    const segment = layout.segments.get(edge.id);
    const label = layout.labels.get(edge.id);
    if (segment === undefined || label === undefined) return [];
    const selectionOf = { kind: "edge" as const, id: edge.id };
    const status = statusOf(selectionOf, edge.incomplete, issues);
    const from = names.get(edge.from)?.title ?? edge.from;
    const to = names.get(edge.to)?.title ?? edge.to;
    const text = edge.label?.trim() ? `, «${edge.label.trim()}»` : "";
    return [
      {
        id: flowId.edge(edge.id),
        type: "editorEdge",
        source: flowId.node(edge.from),
        target: flowId.node(edge.to),
        selectable: false,
        focusable: false,
        zIndex: Z.edge,
        data: {
          edge,
          segment,
          label: label.point,
          name: `Arista, paso ${edge.step ?? "sin número"}: de ${from} a ${to}${text}${statusSuffix(status)}`,
          status,
          selected: isSelected(selection, selectionOf),
        },
      },
    ];
  });
};
