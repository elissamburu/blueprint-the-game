// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Nodes and edges of the visual editor (DiagramEditor). Each element is one focus target of the
// canvas (`data-diagram-element`, tabIndex -1: the canvas moves the focus with Tab, in reading
// order), named for screen readers, and shows whether it is incomplete or has issues with an icon
// and a word. Groups are moved from their label, so a press on their body pans the canvas; leaf
// nodes are dragged by React Flow and connected from their handle (●).
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { cn } from "@blueprint/ui/lib/utils";
import {
  EdgeLabelRenderer,
  Handle,
  NodeResizer,
  Position,
  type EdgeProps,
  type NodeProps,
  type ResizeParams,
} from "@xyflow/react";
import {
  Building2Icon,
  CircleHelpIcon,
  CircleXIcon,
  GripVerticalIcon,
  TriangleAlertIcon,
  UserIcon,
} from "lucide-react";
import { createContext, useContext, type PointerEvent as ReactPointerEvent } from "react";
import { drawnKind, MIN_GROUP_SIZE, selectionKey, type DiagramSelection } from "./editor-model";
import type { EditorFlowEdge, EditorGroupNode, EditorLeafNode, ElementStatus } from "./editor-flow";
import { ACTOR_ICONS, GROUP_STYLES, NO_PAN } from "./nodes";

export interface EditorContextValue {
  readOnly: boolean;
  /** An element got the focus (Tab, a click): it becomes the selection. */
  onElementFocus: (selection: DiagramSelection) => void;
  /** A press on the label of a group: the start of a move (or a click, if it does not move). */
  onGroupPointerDown: (groupId: string, event: ReactPointerEvent<HTMLElement>) => void;
  /** End of a resize with the handles of a selected group (React Flow's parent-relative box). */
  onGroupResizeEnd: (groupId: string, params: ResizeParams) => void;
  markers: { idle: string; active: string };
}

export const EditorContext = createContext<EditorContextValue | null>(null);

const useEditorContext = (): EditorContextValue => {
  const value = useContext(EditorContext);
  if (value === null) throw new Error("Editor nodes must be rendered inside <DiagramEditor>");
  return value;
};

/** Attribute that marks the focus targets of the canvas, with the selection key as its value. */
export const ELEMENT_ATTRIBUTE = "data-diagram-element";

const elementProps = (
  selection: DiagramSelection,
  name: string,
  onFocus: (selection: DiagramSelection) => void,
) => ({
  [ELEMENT_ATTRIBUTE]: selectionKey(selection),
  tabIndex: -1,
  role: "button",
  "aria-label": name,
  onFocus: () => onFocus(selection),
});

/** The selection, also visible in forced colors: a thick outline apart from the border. */
const SELECTED = "outline-[3px] outline-offset-[3px] outline-primary outline-solid";

function StatusMark({ status }: { status: ElementStatus }) {
  if (status.level === null) return null;
  const Icon = status.level === "error" ? CircleXIcon : TriangleAlertIcon;
  return (
    <span
      aria-hidden="true"
      data-status={status.level}
      className={cn(
        "absolute -top-[10px] right-[6px] z-10 flex h-[18px] items-center gap-[3px] rounded-[4px] border bg-card px-[4px] text-[9.6px] leading-none font-bold whitespace-nowrap",
        status.level === "error"
          ? "border-destructive text-destructive"
          : "border-warning text-warning",
      )}
    >
      <Icon className="size-[11px]" />
      {status.text}
    </span>
  );
}

/** Where an edge can end: the whole node (the editor also takes a drop anywhere on the node). */
const TARGET_HANDLE = {
  left: "50%",
  top: "50%",
  opacity: 0,
  pointerEvents: "none",
} as const;

export function EditorLeaf({ data }: NodeProps<EditorLeafNode>) {
  const { node, typeName, title, name, status, selected, service } = data;
  const { readOnly, onElementFocus } = useEditorContext();
  const selection = { kind: "node", id: node.id } as const;
  const ActorIcon =
    (ACTOR_ICONS as Record<string, typeof UserIcon>)[node.icon ?? ""] ??
    (node.type === "external" ? Building2Icon : UserIcon);
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={!readOnly}
        style={TARGET_HANDLE}
      />
      <div
        {...elementProps(selection, name, onElementFocus)}
        data-node-type={node.type}
        className={cn(
          "relative size-full rounded-[7px] border bg-card p-[8px] shadow-[0_5px_14px_color-mix(in_oklab,var(--foreground)_7%,transparent)] focus:outline-none",
          node.type === "external" && "border-dashed border-slot-border bg-muted",
          node.type === "slot" && "border-2 border-dashed border-primary",
          selected && SELECTED,
        )}
      >
        {(node.type === "actor" || node.type === "external") && (
          <div className="flex size-full flex-col items-center justify-center gap-[4.8px] text-center">
            <ActorIcon aria-hidden="true" className="size-[20px] shrink-0 text-muted-foreground" />
            <strong className="line-clamp-2 text-[10.88px] leading-tight">{title}</strong>
          </div>
        )}
        {node.type === "fixed" && (
          <div className="grid size-full grid-cols-[auto_1fr] items-center gap-[8px]">
            <ServiceIcon
              src={service?.iconSrc}
              name={title}
              category={service?.category ?? ""}
              decorative
              className="text-[9.28px]"
            />
            <strong className="line-clamp-2 text-[11.2px] leading-tight">{title}</strong>
          </div>
        )}
        {node.type === "slot" && (
          <div className="flex size-full flex-col items-center justify-center gap-[6px] text-center">
            <CircleHelpIcon aria-hidden="true" className="size-[28px] shrink-0 text-primary" />
            <span className="text-[9.6px] font-[850] text-primary uppercase">{typeName}</span>
            <span className="line-clamp-4 text-[10.88px] leading-tight">{title}</span>
          </div>
        )}
        <StatusMark status={status} />
      </div>
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={!readOnly}
        title="Arrastrá para conectar"
        className={cn(
          "!size-[12px] !border-2 !border-card !bg-primary",
          (readOnly || !selected) && "opacity-0 [.react-flow\\_\\_node:hover_&]:opacity-100",
          readOnly && "!hidden",
        )}
      />
    </>
  );
}

export function EditorGroup({ data }: NodeProps<EditorGroupNode>) {
  const { group, title, name, status, selected } = data;
  const { readOnly, onElementFocus, onGroupPointerDown, onGroupResizeEnd } = useEditorContext();
  const selection = { kind: "group", id: group.id } as const;
  return (
    <>
      <NodeResizer
        isVisible={selected && !readOnly}
        minWidth={MIN_GROUP_SIZE.w}
        minHeight={MIN_GROUP_SIZE.h}
        color="var(--primary)"
        handleClassName="!size-[10px] !rounded-[2px]"
        onResizeEnd={(_, params) => onGroupResizeEnd(group.id, params)}
      />
      <div
        {...elementProps(selection, name, onElementFocus)}
        data-group-kind={drawnKind(group)}
        className={cn(
          "relative size-full rounded-[9px] focus:outline-none",
          GROUP_STYLES[drawnKind(group)],
          selected && SELECTED,
        )}
      >
        <span
          data-group-handle={group.id}
          title={readOnly ? undefined : "Arrastrá para mover el grupo"}
          onPointerDown={(event) => onGroupPointerDown(group.id, event)}
          className={cn(
            "absolute top-[6px] left-[8px] flex h-[18px] max-w-[calc(100%-16px)] items-center gap-[2px] rounded-[4px] bg-card px-[4px] text-[9.6px] leading-none font-[850] whitespace-nowrap text-primary uppercase select-none",
            !readOnly && "cursor-grab active:cursor-grabbing",
            "nodrag",
            NO_PAN,
          )}
        >
          {!readOnly && <GripVerticalIcon aria-hidden="true" className="size-[11px] shrink-0" />}
          <span className="truncate">{title}</span>
        </span>
        <StatusMark status={status} />
      </div>
    </>
  );
}

/**
 * Edge of the editor: the line, and its step number in a circle on the free stretch of the edge
 * (geometry.ts), which is the focus target of the edge (an HTML element over the canvas, as the
 * step markers of the board).
 */
export function EditorEdge({ id, data }: EdgeProps<EditorFlowEdge>) {
  const { onElementFocus, markers } = useEditorContext();
  if (data === undefined) return null;
  const { edge, segment, label, name, status, selected } = data;
  const { start, end } = segment;
  const path = `M ${start.x},${start.y} L ${end.x},${end.y}`;
  const selection = { kind: "edge", id: edge.id } as const;
  return (
    <>
      <g data-edge-id={edge.id} data-selected={selected} className="cursor-pointer">
        {/* A wide, invisible line: an easy target for the pointer. */}
        <path d={path} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
        <path
          id={id}
          d={path}
          fill="none"
          markerEnd={`url(#${selected ? markers.active : markers.idle})`}
          vectorEffect="non-scaling-stroke"
          style={{
            stroke: selected ? "var(--primary)" : "var(--muted-foreground)",
            strokeWidth: selected ? 2.5 : 1.25,
            strokeDasharray: selected ? undefined : "4 3",
          }}
        />
      </g>
      <EdgeLabelRenderer>
        <div
          {...elementProps(selection, name, onElementFocus)}
          data-status={status.level ?? undefined}
          style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
          className={cn(
            "pointer-events-auto absolute top-0 left-0 grid size-[20px] cursor-pointer place-items-center rounded-full border bg-card text-[10px] leading-none font-[850] text-foreground focus:outline-none",
            NO_PAN,
            status.level === "error" && "border-2 border-destructive",
            status.level === "warning" && "border-2 border-warning",
            status.level === null && "border-muted-foreground",
            selected && cn("bg-primary text-primary-foreground", SELECTED),
          )}
        >
          <span aria-hidden="true">{edge.step ?? "?"}</span>
          {status.level !== null && (
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-[22px] text-[11px] font-[850]",
                status.level === "error" ? "text-destructive" : "text-warning",
              )}
            >
              {status.level === "error" ? "✗" : "⚠"}
            </span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const editorNodeTypes = { editorGroup: EditorGroup, editorLeaf: EditorLeaf };
export const editorEdgeTypes = { editorEdge: EditorEdge };
