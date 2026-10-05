// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Visual editor of the diagram (RF-STU-04; ADR-0025 §2 and its amendment of 2026-10-05). It draws
// a draft of the diagram (parseDiagramDraft) and emits commands (editor-model.ts) named by id; it
// never sees the YAML. The Studio turns the commands into the same document edits as the form.
//
// Pointer: drag a node, or a group by its label; resize a selected group by its handles; drag from
// the handle (●) of a node to another node to connect them; drag a type from the palette to the
// canvas (or click it: it goes to the center of the view).
// Keyboard (only while the canvas or one of its elements has the focus, never in a text field:
// WCAG 2.1.4): Tab and Shift+Tab go through the elements in reading order; arrows move the
// selection by 10 (Shift: by 1) and, with nothing selected, pan; Alt+arrows resize a group; C
// opens "Conectar con…"; Supr asks to remove; Enter opens the selection in the app's inspector;
// Alt+Re Pág / Av Pág move an edge one step earlier or later; Ctrl+Z / Ctrl+Y undo and redo. Esc
// and then Tab leave the canvas, as in the YAML editor (WCAG 2.1.2); the help next to the canvas
// says so.
import "@xyflow/react/dist/base.css";
import { Button } from "@blueprint/ui/components/button";
import { useReducedMotion } from "@blueprint/ui/lib/use-reduced-motion";
import { cn } from "@blueprint/ui/lib/utils";
import { GROUP_KINDS, NODE_TYPES, type DiagramDraft } from "@blueprint/scenario-schema";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type FinalConnectionState,
  type NodeChange,
  type ResizeParams,
} from "@xyflow/react";
import { CableIcon, Trash2Icon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { ConnectDialog } from "./ConnectDialog";
import {
  ARROW_PAN,
  ArrowMarkers,
  FIT_PADDING,
  MAX_ZOOM,
  MIN_ZOOM,
  useMarkers,
  ZoomControls,
} from "./Diagram";
import {
  nodeNames,
  toEditorEdges,
  toEditorNodes,
  type EditorFlowEdge,
  type EditorFlowNode,
  type ElementIssues,
} from "./editor-flow";
import {
  addGroupCommand,
  addNodeCommand,
  draftNodeBox,
  GROUP_KIND_NAMES,
  hasElement,
  MIN_GROUP_SIZE,
  NODE_TYPE_NAMES,
  NUDGE,
  nudge,
  placeGroup,
  placeNode,
  readingOrder,
  sameSelection,
  selectionKey,
  snap,
  type DiagramCommand,
  type DiagramSelection,
} from "./editor-model";
import {
  EditorContext,
  editorEdgeTypes,
  editorNodeTypes,
  ELEMENT_ATTRIBUTE,
  type EditorContextValue,
} from "./editor-nodes";
import { flowId } from "./flow-model";
import type { Box, Point } from "./geometry";
import { NO_PAN } from "./nodes";
import type { ServiceLookup } from "./types";
import { revealViewport } from "./viewport";

export interface DiagramEditorHandle {
  /** Selects and focuses an element of the canvas (showing it), or the canvas with null. */
  focus: (selection: DiagramSelection | null) => void;
  /** Pans the canvas so the element is in view, without moving the focus. */
  reveal: (selection: DiagramSelection) => void;
  /** Opens "Conectar con…" for the selected node. */
  openConnect: () => void;
}

export interface DiagramEditorProps {
  draft: DiagramDraft;
  services: ServiceLookup;
  /** The selected (and focused) element; the app keeps it. */
  selection: DiagramSelection | null;
  onSelectionChange: (selection: DiagramSelection | null) => void;
  onCommand: (command: DiagramCommand) => void;
  /** Issues of the elements (the validation of the app), by `selectionKey`. */
  issues?: ElementIssues | undefined;
  /** Nothing can be changed: the YAML does not parse. */
  readOnly?: boolean | undefined;
  /** Enter on an element: the app takes the focus to its inspector. */
  onActivate?: ((selection: DiagramSelection) => void) | undefined;
  onUndo?: (() => void) | undefined;
  onRedo?: (() => void) | undefined;
  onSave?: (() => void) | undefined;
  /** Accessible name of the canvas. */
  label?: string | undefined;
  /** Actions of the app, first in the toolbar of the editor (the Studio's "Ordenar"). */
  actions?: ReactNode;
  /** Id of the canvas, so the app can give it the focus back. */
  id?: string | undefined;
  className?: string | undefined;
  ref?: Ref<DiagramEditorHandle> | undefined;
}

/** What a palette item carries when dragged to the canvas: `node:<type>` or `group:<kind>`. */
export const PALETTE_DRAG_TYPE = "application/x-blueprint-diagram";

export const EDITOR_HELP =
  "Tab y Mayús + Tab recorren los elementos. Flechas: mover de a 10 (con Mayús, de a 1). " +
  "Alt + flechas: cambiar el tamaño de un grupo. C: conectar con… Supr: eliminar. " +
  "Enter: editar en el inspector. Alt + Re Pág / Av Pág: cambiar el paso de una arista. " +
  "Para salir del diagrama: Esc y después Tab (o Mayús + Tab).";

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

const MODIFIERS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph"]);

const leafId = (flowNodeId: string | null | undefined): string | undefined =>
  flowNodeId?.startsWith("node:") ? flowNodeId.slice("node:".length) : undefined;

const attributeValue = (value: string) => value.replace(/["\\]/g, "\\$&");

/** A key event is the canvas's only on the canvas itself or one of its elements (WCAG 2.1.4). */
const onCanvas = (event: KeyboardEvent<HTMLElement>): boolean =>
  event.target === event.currentTarget ||
  (event.target instanceof Element && event.target.hasAttribute(ELEMENT_ATTRIBUTE));

/**
 * The new nodes with the sizes React Flow measured on the previous ones: without them it measures
 * the nodes again and, meanwhile, unmounts their edges (and the focus of an edge is lost).
 */
const keepMeasured = (
  next: EditorFlowNode[],
  previous: readonly EditorFlowNode[],
): EditorFlowNode[] => {
  const measured = new Map(previous.map((node) => [node.id, node.measured]));
  return next.map((node) => {
    const size = measured.get(node.id);
    return size === undefined || size.width !== node.width || size.height !== node.height
      ? node
      : { ...node, measured: size };
  });
};

export function DiagramEditor(props: DiagramEditorProps) {
  return (
    <ReactFlowProvider>
      <EditorCanvas {...props} />
    </ReactFlowProvider>
  );
}

interface GroupDrag {
  id: string;
  start: Point;
  origin: Point;
  zoom: number;
  delta: Point;
  moved: boolean;
}

function EditorCanvas({
  draft,
  services,
  selection,
  onSelectionChange,
  onCommand,
  issues,
  readOnly = false,
  onActivate,
  onUndo,
  onRedo,
  onSave,
  label = "Editor del diagrama",
  actions,
  id,
  className,
  ref,
}: DiagramEditorProps) {
  const flow = useReactFlow<EditorFlowNode, EditorFlowEdge>();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const helpId = useId();
  const markers = useMarkers();
  /** Esc was the last key: the next Tab leaves the canvas. */
  const escaped = useRef(false);
  /** The element to focus once it is rendered. */
  const pendingFocus = useRef<DiagramSelection | null>(null);
  const [connecting, setConnecting] = useState(false);

  const flowInput = useMemo(() => ({ services, selection, issues }), [services, selection, issues]);
  const baseNodes = useMemo(() => toEditorNodes(draft, flowInput), [draft, flowInput]);
  const edges = useMemo(() => toEditorEdges(draft, flowInput), [draft, flowInput]);
  // The nodes as React Flow moves them while dragging; a new draft starts over from it.
  const [local, setLocal] = useState({ base: baseNodes, nodes: baseNodes });
  if (local.base !== baseNodes) {
    setLocal({ base: baseNodes, nodes: keepMeasured(baseNodes, local.nodes) });
  }
  const nodes = local.base === baseNodes ? local.nodes : baseNodes;
  const onNodesChange = useCallback(
    (changes: NodeChange<EditorFlowNode>[]) =>
      setLocal((current) => ({ ...current, nodes: applyNodeChanges(changes, current.nodes) })),
    [],
  );
  const restore = useCallback(
    () => setLocal((current) => ({ ...current, nodes: current.base })),
    [],
  );

  // Edges whose nodes are missing are not drawn, so Tab skips them.
  const drawnEdges = useMemo(() => new Set(edges.map((edge) => edge.data?.edge.id)), [edges]);
  const order = useMemo(
    () => readingOrder(draft).filter((item) => item.kind !== "edge" || drawnEdges.has(item.id)),
    [draft, drawnEdges],
  );

  const select = useCallback(
    (next: DiagramSelection | null) => {
      if (!sameSelection(next, selection)) onSelectionChange(next);
    },
    [selection, onSelectionChange],
  );

  const boxOf = useCallback(
    (target: DiagramSelection): Box | undefined => {
      if (target.kind === "group") {
        return draft.groups.find((group) => group.id === target.id)?.rect;
      }
      if (target.kind === "node") {
        const node = draft.nodes.find((candidate) => candidate.id === target.id);
        return node === undefined ? undefined : draftNodeBox(node);
      }
      const segment = edges.find((edge) => edge.data?.edge.id === target.id)?.data?.segment;
      if (segment === undefined) return undefined;
      const x = Math.min(segment.start.x, segment.end.x);
      const y = Math.min(segment.start.y, segment.end.y);
      return {
        x,
        y,
        w: Math.abs(segment.end.x - segment.start.x),
        h: Math.abs(segment.end.y - segment.start.y),
      };
    },
    [draft, edges],
  );

  const reveal = useCallback(
    (target: DiagramSelection) => {
      const box = boxOf(target);
      const canvas = canvasRef.current;
      if (box === undefined || canvas === null) return;
      const next = revealViewport(box, flow.getViewport(), {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      });
      if (next !== null) {
        void flow.setViewport(next, { duration: reducedMotion ? 0 : 200, interpolate: "linear" });
      }
    },
    [boxOf, flow, reducedMotion],
  );

  const focusElement = useCallback(
    (target: DiagramSelection | null) => {
      select(target);
      if (target === null) {
        pendingFocus.current = null;
        canvasRef.current?.focus();
        return;
      }
      pendingFocus.current = target;
    },
    [select],
  );

  // After every render: the element waiting for the focus may be there now.
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const element = canvasRef.current?.querySelector<HTMLElement>(
      `[${ELEMENT_ATTRIBUTE}="${attributeValue(selectionKey(target))}"]`,
    );
    if (element === null || element === undefined) return;
    pendingFocus.current = null;
    element.focus({ preventScroll: true });
    reveal(target);
  });

  // A selection whose element is gone (removed, undone, renamed in the YAML) is dropped.
  useEffect(() => {
    if (selection !== null && !hasElement(draft, selection)) onSelectionChange(null);
  }, [draft, selection, onSelectionChange]);

  // If the element with the focus is gone, the focus goes back to the canvas instead of getting
  // lost (WCAG 2.4.3). React Flow takes it out of the page after this effect, so it is still there.
  useEffect(() => {
    const active = document.activeElement;
    const key = active?.getAttribute(ELEMENT_ATTRIBUTE);
    const canvas = canvasRef.current;
    if (key == null || canvas === null || !canvas.contains(active)) return;
    const separator = key.indexOf(":");
    const kind = key.slice(0, separator);
    const id = key.slice(separator + 1);
    if (kind !== "group" && kind !== "node" && kind !== "edge") return;
    if (!hasElement(draft, { kind, id })) canvas.focus();
  }, [draft]);

  const connectSource =
    selection?.kind === "node" && draft.nodes.some((node) => node.id === selection.id)
      ? selection.id
      : undefined;
  const openConnect = useCallback(() => {
    if (!readOnly && connectSource !== undefined) setConnecting(true);
  }, [readOnly, connectSource]);

  useImperativeHandle(
    ref,
    () => ({
      focus: focusElement,
      reveal,
      openConnect,
    }),
    [focusElement, reveal, openConnect],
  );

  const emit = useCallback(
    (command: DiagramCommand) => {
      if (!readOnly) onCommand(command);
    },
    [readOnly, onCommand],
  );

  const panBy = (dx: number, dy: number) => {
    const { x, y, zoom } = flow.getViewport();
    void flow.setViewport({ x: x + dx, y: y + dy, zoom });
  };

  const centerOfView = (): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect === undefined) return { x: 0, y: 0 };
    return flow.screenToFlowPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  };

  const addAt = (item: string, point: Point) => {
    const [kind, value] = item.split(":");
    const nodeType = NODE_TYPES.find((type) => type === value);
    const groupKind = GROUP_KINDS.find((candidate) => candidate === value);
    if (kind === "node" && nodeType !== undefined) emit(addNodeCommand(draft, nodeType, point));
    if (kind === "group" && groupKind !== undefined) emit(addGroupCommand(draft, groupKind, point));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // A modifier alone (the Shift of Shift+Tab) keeps the way out open.
    if (!onCanvas(event) || MODIFIERS.has(event.key)) return;
    const wasEscaped = escaped.current;
    escaped.current = false;
    const key = event.key;
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const letter = key.toLowerCase();
      if (letter === "z" || letter === "y") {
        event.preventDefault();
        if (letter === "y" || event.shiftKey) onRedo?.();
        else onUndo?.();
      } else if (letter === "s") {
        event.preventDefault();
        onSave?.();
      }
      return;
    }
    if (key === "Tab") {
      // After Esc the browser takes the focus out of the canvas.
      if (wasEscaped || order.length === 0) return;
      event.preventDefault();
      const at =
        selection === null ? -1 : order.findIndex((item) => sameSelection(item, selection));
      const step = event.shiftKey ? -1 : 1;
      const next =
        at === -1 && step === -1 ? order.length - 1 : (at + step + order.length) % order.length;
      const target = order[next];
      if (target !== undefined) focusElement(target);
      return;
    }
    if (key === "Escape") {
      event.preventDefault();
      focusElement(null);
      escaped.current = true;
      return;
    }
    const arrow = ARROWS[key];
    if (arrow !== undefined && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      if (selection !== null && selection.kind !== "edge") {
        const amount = event.shiftKey ? NUDGE.fine : NUDGE.step;
        const placements = nudge(
          draft,
          selection,
          arrow[0] * amount,
          arrow[1] * amount,
          event.altKey,
        );
        if (placements.length > 0) emit({ type: "place", placements, input: "keyboard" });
      } else if (!event.altKey) {
        panBy(-arrow[0] * ARROW_PAN, -arrow[1] * ARROW_PAN);
      }
      return;
    }
    if (event.altKey && (key === "PageUp" || key === "PageDown")) {
      if (selection?.kind !== "edge") return;
      event.preventDefault();
      emit({ type: "moveStep", edgeId: selection.id, direction: key === "PageUp" ? -1 : 1 });
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (key === "Delete" && selection !== null) {
      event.preventDefault();
      emit({ type: "remove", target: selection });
    } else if (key === "Enter" && selection !== null) {
      event.preventDefault();
      onActivate?.(selection);
    } else if ((key === "c" || key === "C") && connectSource !== undefined) {
      event.preventDefault();
      openConnect();
    }
  };

  // --- Pointer -----------------------------------------------------------------------------------

  const onGroupPointerDown = useCallback(
    (groupId: string, event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      focusElement({ kind: "group", id: groupId });
      const flowNode = local.nodes.find((node) => node.id === flowId.group(groupId));
      if (readOnly || flowNode === undefined) return;
      event.stopPropagation();
      const handle = event.currentTarget;
      handle.setPointerCapture?.(event.pointerId);
      const drag: GroupDrag = {
        id: groupId,
        start: { x: event.clientX, y: event.clientY },
        origin: flowNode.position,
        zoom: flow.getViewport().zoom,
        delta: { x: 0, y: 0 },
        moved: false,
      };
      const target = flowId.group(groupId);
      const move = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - drag.start.x) / drag.zoom;
        const dy = (moveEvent.clientY - drag.start.y) / drag.zoom;
        if (!drag.moved && Math.hypot(dx, dy) * drag.zoom < 3) return;
        drag.moved = true;
        drag.delta = { x: dx, y: dy };
        setLocal((current) => ({
          ...current,
          nodes: current.nodes.map((node) =>
            node.id === target
              ? { ...node, position: { x: drag.origin.x + dx, y: drag.origin.y + dy } }
              : node,
          ),
        }));
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        const group = draft.groups.find((candidate) => candidate.id === groupId);
        if (!drag.moved || group === undefined) return;
        const rect = {
          ...group.rect,
          x: snap(group.rect.x + drag.delta.x),
          y: snap(group.rect.y + drag.delta.y),
        };
        if (rect.x === group.rect.x && rect.y === group.rect.y) {
          restore();
          return;
        }
        emit({ type: "place", placements: placeGroup(draft, groupId, rect), input: "pointer" });
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    },
    [draft, emit, flow, focusElement, local.nodes, readOnly, restore],
  );

  const onGroupResizeEnd = useCallback(
    (groupId: string, params: ResizeParams) => {
      const group = draft.groups.find((candidate) => candidate.id === groupId);
      if (group === undefined) return;
      const parent =
        group.parent == null
          ? undefined
          : draft.groups.find((candidate) => candidate.id === group.parent);
      const rect = {
        x: snap(params.x + (parent?.rect.x ?? 0)),
        y: snap(params.y + (parent?.rect.y ?? 0)),
        w: Math.max(MIN_GROUP_SIZE.w, snap(params.width)),
        h: Math.max(MIN_GROUP_SIZE.h, snap(params.height)),
      };
      const { x, y, w, h } = group.rect;
      if (rect.x === x && rect.y === y && rect.w === w && rect.h === h) {
        restore();
        return;
      }
      emit({ type: "place", placements: placeGroup(draft, groupId, rect), input: "pointer" });
    },
    [draft, emit, restore],
  );

  const context = useMemo(
    (): EditorContextValue => ({
      readOnly,
      onElementFocus: select,
      onGroupPointerDown,
      onGroupResizeEnd,
      markers,
    }),
    [readOnly, select, onGroupPointerDown, onGroupResizeEnd, markers],
  );

  const onNodeDragStop = (_: unknown, flowNode: EditorFlowNode) => {
    if (flowNode.type !== "editorLeaf") return;
    const { node } = flowNode.data;
    const parent =
      node.group === undefined
        ? undefined
        : draft.groups.find((candidate) => candidate.id === node.group);
    const position = {
      x: snap(flowNode.position.x + (parent?.rect.x ?? 0)),
      y: snap(flowNode.position.y + (parent?.rect.y ?? 0)),
    };
    if (position.x === node.position.x && position.y === node.position.y) {
      restore();
      return;
    }
    emit({ type: "place", placements: placeNode(draft, node.id, position), input: "pointer" });
  };

  const connect = (from: string | undefined, to: string | undefined) => {
    if (from !== undefined && to !== undefined && from !== to) {
      emit({ type: "connect", from, to });
    }
  };

  /** A drop anywhere on a node (not only on its handle) also connects. */
  const onConnectEnd = (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
    if (state.isValid === true) return;
    const from = leafId(state.fromNode?.id);
    const point = "changedTouches" in event ? event.changedTouches[0] : event;
    if (from === undefined || point === undefined) return;
    const target = document
      .elementsFromPoint(point.clientX, point.clientY)
      .map((element) => element.closest(`[${ELEMENT_ATTRIBUTE}^="node:"]`))
      .find((element) => element !== null);
    const to = target?.getAttribute(ELEMENT_ATTRIBUTE)?.slice("node:".length);
    connect(from, to);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (readOnly || !event.dataTransfer.types.includes(PALETTE_DRAG_TYPE)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const item = event.dataTransfer.getData(PALETTE_DRAG_TYPE);
    if (readOnly || item === "") return;
    event.preventDefault();
    addAt(item, flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const width = draft.canvas?.width ?? 1200;
  const height = draft.canvas?.height ?? 800;
  const fit = (animated: boolean) =>
    void flow.fitBounds(
      { x: 0, y: 0, width, height },
      { padding: FIT_PADDING, duration: animated && !reducedMotion ? 200 : 0 },
    );

  const names = useMemo(() => nodeNames(draft, services), [draft, services]);
  const sourceName = connectSource === undefined ? "" : (names.get(connectSource)?.title ?? "");
  const nextStep = Math.max(0, ...draft.edges.map((edge) => edge.step ?? 0)) + 1;

  return (
    <EditorContext.Provider value={context}>
      <div
        data-slot="diagram-editor"
        className={cn(
          "grid min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[9.5rem_minmax(0,1fr)]",
          className,
        )}
      >
        <div
          role="toolbar"
          aria-label="Acciones del diagrama"
          className="flex flex-wrap items-center gap-2 sm:col-span-2"
        >
          {actions}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || connectSource === undefined}
            onClick={openConnect}
          >
            <CableIcon aria-hidden />
            Conectar con…
            <kbd className="text-xs text-muted-foreground">C</kbd>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={readOnly || selection === null}
            onClick={() => selection !== null && emit({ type: "remove", target: selection })}
          >
            <Trash2Icon aria-hidden />
            Eliminar…
            <kbd className="text-xs text-muted-foreground">Supr</kbd>
          </Button>
          {draft.skipped > 0 && (
            <p role="status" className="text-sm text-warning">
              {draft.skipped === 1
                ? "1 elemento no se puede dibujar: le falta un id, un tipo o una posición válidos."
                : `${draft.skipped} elementos no se pueden dibujar: les falta un id, un tipo o una posición válidos.`}
            </p>
          )}
        </div>
        <Palette readOnly={readOnly} onAdd={(item) => addAt(item, centerOfView())} />
        <div className="relative min-h-[20rem]">
          <div
            ref={canvasRef}
            id={id}
            role="application"
            aria-roledescription="editor de diagrama"
            aria-label={label}
            aria-describedby={helpId}
            aria-readonly={readOnly || undefined}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onDragOver={onDragOver}
            onDrop={onDrop}
            // Focusing an element out of view makes the browser scroll this overflow:hidden box,
            // which moves the canvas out of React Flow's control: pan with the viewport instead.
            onScroll={(event) => {
              event.currentTarget.scrollTop = 0;
              event.currentTarget.scrollLeft = 0;
            }}
            className="absolute inset-0 overflow-hidden rounded-md border bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring/55"
          >
            <ArrowMarkers markers={markers} />
            <ReactFlow<EditorFlowNode, EditorFlowEdge>
              nodes={nodes}
              edges={edges}
              nodeTypes={editorNodeTypes}
              edgeTypes={editorEdgeTypes}
              onNodesChange={onNodesChange}
              onInit={(instance) =>
                void instance.fitBounds({ x: 0, y: 0, width, height }, { padding: FIT_PADDING })
              }
              nodesDraggable={!readOnly}
              nodesConnectable={!readOnly}
              nodesFocusable={false}
              edgesFocusable={false}
              elementsSelectable={false}
              disableKeyboardA11y
              deleteKeyCode={null}
              selectionKeyCode={null}
              multiSelectionKeyCode={null}
              panActivationKeyCode={null}
              zoomActivationKeyCode={null}
              zoomOnDoubleClick={false}
              zIndexMode="manual"
              noPanClassName={NO_PAN}
              onNodeClick={(_, node) =>
                focusElement({
                  kind: node.type === "editorGroup" ? "group" : "node",
                  id: node.type === "editorGroup" ? node.data.group.id : node.data.node.id,
                })
              }
              onNodeDragStart={(_, node) =>
                node.type === "editorLeaf" && focusElement({ kind: "node", id: node.data.node.id })
              }
              onNodeDragStop={onNodeDragStop}
              onEdgeClick={(_, edge) =>
                edge.data !== undefined && focusElement({ kind: "edge", id: edge.data.edge.id })
              }
              onPaneClick={() => select(null)}
              onConnect={(connection: Connection) =>
                connect(leafId(connection.source), leafId(connection.target))
              }
              onConnectEnd={onConnectEnd}
              isValidConnection={(connection) =>
                leafId(connection.source) !== undefined &&
                leafId(connection.target) !== undefined &&
                connection.source !== connection.target
              }
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              panOnDrag
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              zoomOnScroll={false}
              zoomOnPinch
              preventScrolling
              // A link inside the canvas would be a Tab stop between Esc and the way out. React
              // Flow asks for a visible attribution or a Pro subscription
              // (https://reactflow.dev/api-reference/types/pro-options): the credit is
              // given in "Acerca de" of the game and in apps/studio/README.md.
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1}
                color="var(--border)"
              />
            </ReactFlow>
          </div>
          <div className="pointer-events-none absolute bottom-3 left-3 z-10 *:pointer-events-auto">
            <ZoomControls onReset={() => fit(true)} duration={reducedMotion ? 0 : 150} />
          </div>
        </div>
        <p id={helpId} className="text-sm text-muted-foreground sm:col-start-2">
          {EDITOR_HELP}
        </p>
      </div>
      {connecting && connectSource !== undefined && (
        <ConnectDialog
          source={sourceName}
          nextStep={nextStep}
          targets={draft.nodes
            .filter((node) => node.id !== connectSource)
            .map((node) => ({
              id: node.id,
              typeName: names.get(node.id)?.typeName ?? "",
              title: names.get(node.id)?.title ?? node.id,
            }))}
          onClose={() => setConnecting(false)}
          onConnect={(to) => {
            setConnecting(false);
            connect(connectSource, to);
          }}
        />
      )}
    </EditorContext.Provider>
  );
}

function Palette({ readOnly, onAdd }: { readOnly: boolean; onAdd: (item: string) => void }) {
  const item = (value: string, text: string) => (
    <li key={value}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={readOnly}
        draggable={!readOnly}
        onDragStart={(event) => {
          event.dataTransfer.setData(PALETTE_DRAG_TYPE, value);
          event.dataTransfer.effectAllowed = "copy";
        }}
        onClick={() => onAdd(value)}
        aria-label={`Agregar ${text}`}
        className="w-full justify-start"
      >
        {text}
      </Button>
    </li>
  );
  return (
    <nav aria-label="Paleta del diagrama" className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Nodos</h3>
        <ul className="flex flex-col gap-1">
          {NODE_TYPES.map((type) => item(`node:${type}`, NODE_TYPE_NAMES[type]))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Grupos</h3>
        <ul className="flex flex-col gap-1">
          {GROUP_KINDS.map((kind) => item(`group:${kind}`, GROUP_KIND_NAMES[kind]))}
        </ul>
      </div>
      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          Arrastralos al diagrama, o elegilos para agregarlos en el centro de la vista.
        </p>
      )}
    </nav>
  );
}
