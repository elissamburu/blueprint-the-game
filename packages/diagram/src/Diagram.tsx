// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Board of a scenario (RF-PLAY-02, RF-PLAY-03, RF-PLAY-11): the `diagram` block drawn with React
// Flow at the YAML positions, with floating zoom controls, the flow player and the list of steps,
// which is the text alternative of the board. It does not decide grades nor import game-engine:
// slot states come in by props and it only emits events (ADR-0008: the app turns them into engine
// commands). With `preview` it is a small, still picture of the diagram with empty slots; with
// `print`, the still picture of the printable page (RF-PLAY-16), with the slots numbered.
// Lovable: .board-zoom, .zoom-controls, .architecture-board, .mini-diagram (src/styles.css).
import "@xyflow/react/dist/base.css";
import { Button } from "@blueprint/ui/components/button";
import type { Diagram as DiagramData } from "@blueprint/scenario-schema";
import { cn } from "@blueprint/ui/lib/utils";
import { useDndMonitor, type DragEndEvent } from "@dnd-kit/core";
import {
  Background,
  BackgroundVariant,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SquareIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { DiagramContext, type DiagramContextValue } from "./context";
import { edgeTypes } from "./edges";
import {
  layoutDiagram,
  toFlowEdges,
  toFlowNodes,
  type FlowNode,
  type StepFlowEdge,
} from "./flow-model";
import type { Box } from "./geometry";
import { NO_PAN, nodeTypes, PrintGroupLabels } from "./nodes";
import { StepMarkers, toStepMarkers } from "./step-markers";
import { describeRoute, describeStep, diagramSteps, edgeSteps, type FlowStep } from "./steps";
import {
  isServiceDragData,
  type ServiceLookup,
  type SlotHintContext,
  type SlotView,
} from "./types";
import {
  endSlotMotion,
  initialSlotMotion,
  SLOT_MOTION_TTL_MS,
  trackSlotMotion,
  type SlotMotionState,
} from "./slot-motion";
import { useFlowPlayer, type FlowPlayer } from "./use-flow-player";
import { useReducedMotion } from "./use-reduced-motion";
import { contentBox, initialView, revealViewport, steppedZoom } from "./viewport";

export const MIN_ZOOM = 0.2;
/** At least 300 % for people with low vision (docs/design, problem 27). */
export const MAX_ZOOM = 3;
const FIT_PADDING = 0.04;
/** Screen pixels an arrow key pans the focused board. */
export const ARROW_PAN = 64;

/** What the app can ask of the board besides its props. */
export interface DiagramHandle {
  /** Starts the flow player from the first step (the "Reproducir flujo" action). */
  playFlow: () => void;
  /** Pans the board by screen pixels (positive: the content moves right/down). */
  panBy: (dx: number, dy: number) => void;
  /** The focusable board element (the `group` with the diagram), or null before it mounts. */
  element: () => HTMLElement | null;
}

export interface DiagramProps {
  diagram: DiagramData;
  /** Resolves catalog ids (fixed nodes and placed services) to name, category and icon. */
  services: ServiceLookup;
  /** State of each slot by slot id, computed by the app with game-engine. Missing: empty. */
  slots?: Readonly<Record<string, SlotView>> | undefined;
  /**
   * Enter, Space or click on a slot (selectSlot). Without it the board is read-only: slots are
   * not focusable because they would do nothing.
   */
  onSlotActivate?: ((slotId: string) => void) | undefined;
  /**
   * A service (`ServiceDragData`) was dropped on a slot (placeService). With it, every slot is a
   * @dnd-kit drop target, so the board has to be inside the app's `DndContext`.
   */
  onServiceDrop?: ((slotId: string, serviceId: string) => void) | undefined;
  /**
   * Replaces the hint counter of a slot (e.g. a "Ver pista" button with its popover). Return
   * undefined to keep the counter. The context has the id of the role text of the slot, to
   * describe the control with it.
   */
  slotHintAction?: ((slotId: string, context: SlotHintContext) => ReactNode) | undefined;
  /** Accessible name of the board. */
  label?: string | undefined;
  /**
   * `strip`: the steps are listed under the board. `hidden`: the list is only the accessible
   * description of the board (the app shows the steps elsewhere, e.g. in "Ver caso").
   */
  stepList?: "strip" | "hidden" | undefined;
  /** Shows a floating "Reproducir flujo" button. Without it, the app starts the player (handle). */
  playButton?: boolean | undefined;
  /**
   * Small, still picture: fitted to its box, no pan, zoom, controls nor player, slots drawn as
   * empty boxes without text. For the brief before playing.
   */
  preview?: boolean | undefined;
  /**
   * Still picture for the printable page (RF-PLAY-16): like `preview`, but every slot shows its
   * number (`slots[id].number`) and the canvas has no dotted background. The app gives it a fixed
   * size (`printLayout`), since printing does not fit the picture again.
   */
  print?: boolean | undefined;
  /**
   * With `print`: font size (canvas px) of the names of fixed nodes, actors and groups, and the
   * smallest one a name may shrink to (`labelSize` and `minLabelSize` of printLayout).
   */
  printLabels?: { size: number; min: number } | undefined;
  /** Ids of the elements that describe the still picture (its text alternative). */
  describedBy?: string | undefined;
  /** Every change of zoom or position (pan, zoom, reveal, arrows). */
  onViewportChange?: ((viewport: Viewport) => void) | undefined;
  /**
   * Width (px) of the left strip the app covers with its own panel (e.g. "Ver caso"). The floating
   * controls move right of it and a slot reached with Tab is centered in the uncovered part.
   */
  insetLeft?: number | undefined;
  className?: string | undefined;
  ref?: Ref<DiagramHandle> | undefined;
}

export function Diagram(props: DiagramProps) {
  return (
    <ReactFlowProvider>
      {props.preview === true || props.print === true ? (
        <DiagramPreview {...props} />
      ) : (
        <DiagramBoard {...props} />
      )}
    </ReactFlowProvider>
  );
}

function ArrowMarkers({ markers }: { markers: DiagramContextValue["markers"] }) {
  return (
    <svg aria-hidden="true" width="0" height="0" className="absolute">
      <defs>
        <ArrowMarker id={markers.idle} color="var(--muted-foreground)" />
        <ArrowMarker id={markers.active} color="var(--primary)" />
      </defs>
    </svg>
  );
}

const useMarkers = () => {
  const markerId = useId();
  return useMemo(() => ({ idle: `${markerId}-idle`, active: `${markerId}-active` }), [markerId]);
};

/** Read-only settings shared by the board and the preview: nothing is edited on the canvas. */
const STILL_CANVAS = {
  nodesDraggable: false,
  nodesConnectable: false,
  nodesFocusable: false,
  edgesFocusable: false,
  elementsSelectable: false,
  disableKeyboardA11y: true,
  deleteKeyCode: null,
  selectionKeyCode: null,
  multiSelectionKeyCode: null,
  panActivationKeyCode: null,
  zoomOnDoubleClick: false,
  zIndexMode: "manual",
  // Explicit: the nodes and the step buttons put it on their controls.
  noPanClassName: NO_PAN,
} as const;

function DiagramPreview({
  diagram,
  services,
  slots,
  print = false,
  printLabels,
  label = "Vista previa del diagrama",
  describedBy,
  className,
}: DiagramProps) {
  const markers = useMarkers();
  const printLabelSize = print ? printLabels?.size : undefined;
  const layout = useMemo(() => layoutDiagram(diagram, printLabelSize), [diagram, printLabelSize]);
  const nodes = useMemo(
    () => toFlowNodes(diagram, { slots, services }),
    [diagram, slots, services],
  );
  const edges = useMemo(() => toFlowEdges(diagram, layout, null), [diagram, layout]);
  const stepMarkers = useMemo(
    () => toStepMarkers(edges, edgeSteps(diagram, services)),
    [edges, diagram, services],
  );
  const context = useMemo(
    (): DiagramContextValue => ({
      onSlotActivate: undefined,
      slotHintAction: undefined,
      droppable: false,
      reveal: () => {},
      preview: !print,
      print,
      printLabels: print ? (printLabels ?? null) : null,
      animate: false,
      onSlotMotionEnd: ignoreMotionEnd,
      markers,
    }),
    [markers, print, printLabels],
  );
  const content = useMemo(() => contentBox(diagram), [diagram]);
  return (
    <DiagramContext.Provider value={context}>
      <div
        data-slot={print ? "diagram-print" : "diagram-preview"}
        role="img"
        aria-label={label}
        aria-describedby={describedBy}
        className={cn(
          "relative overflow-hidden",
          // Printed, Chrome splits a node across pages by its box before the zoom transform: a
          // group taller than the rest of the sheet would lose its bottom. Contained, the picture
          // is one piece.
          print ? "bg-card [contain:strict]" : "bg-canvas",
          className,
        )}
      >
        {/* A picture: the canvas inside is inert, out of the Tab order and of the a11y tree. */}
        <div inert className="absolute inset-0">
          <ArrowMarkers markers={markers} />
          <ReactFlow<FlowNode, StepFlowEdge>
            {...STILL_CANVAS}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            // The content, not the canvas: the canvas margins would only shrink the picture.
            onInit={(instance) =>
              void instance.fitBounds(
                { x: content.x, y: content.y, width: content.w, height: content.h },
                { padding: FIT_PADDING },
              )
            }
            minZoom={0.02}
            maxZoom={1}
            panOnDrag={false}
            panOnScroll={false}
            // On paper the attribution would read as part of the diagram.
            proOptions={{ hideAttribution: print }}
            zoomOnScroll={false}
            zoomOnPinch={false}
            preventScrolling={false}
            className="pointer-events-none"
          >
            {!print && (
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1}
                color="var(--border)"
              />
            )}
            {print && printLabels !== undefined && (
              <PrintGroupLabels groups={diagram.groups} labels={printLabels} />
            )}
            {/* Printed, the circles are bigger: the picture is drawn at about half its size. */}
            <StepMarkers markers={stepMarkers} interactive={false} scale={print ? 1.6 : 1} />
          </ReactFlow>
        </div>
      </div>
    </DiagramContext.Provider>
  );
}

/** Still pictures play no motion. */
const ignoreMotionEnd = () => {};

/**
 * Motions of the slots of the board (RF-PLAY-17): started when `slots` changes, dropped when they
 * end or, if their end is never heard, after SLOT_MOTION_TTL_MS.
 */
function useSlotMotion(slots: DiagramProps["slots"]) {
  const [state, setState] = useState<SlotMotionState>(() => initialSlotMotion(slots));
  // Updated while rendering, from the previous props (react.dev, "Storing information from
  // previous renders"): the nodes get the motion in the same render as the new state.
  if (state.slots !== slots) setState(trackSlotMotion(state, slots));
  const { motions } = state;

  const onSlotMotionEnd = useCallback(
    (slotId: string, key: number) => setState((current) => endSlotMotion(current, slotId, key)),
    [],
  );
  useEffect(() => {
    const playing = Object.entries(motions);
    if (playing.length === 0) return;
    const timer = window.setTimeout(() => {
      setState((current) =>
        playing.reduce((next, [slotId, { key }]) => endSlotMotion(next, slotId, key), current),
      );
    }, SLOT_MOTION_TTL_MS);
    return () => window.clearTimeout(timer);
  }, [motions]);

  return { motions, onSlotMotionEnd };
}

function DiagramBoard({
  diagram,
  services,
  slots,
  onSlotActivate,
  onServiceDrop,
  slotHintAction,
  label = "Diagrama de la arquitectura",
  stepList = "strip",
  playButton = true,
  onViewportChange,
  insetLeft = 0,
  className,
  ref,
}: DiagramProps) {
  const reducedMotion = useReducedMotion();
  const flow = useReactFlow<FlowNode, StepFlowEdge>();
  const boardRef = useRef<HTMLDivElement>(null);
  const stepsId = useId();
  const helpId = useId();
  const markers = useMarkers();

  const steps = useMemo(() => diagramSteps(diagram, services), [diagram, services]);
  const player = useFlowPlayer(steps.length, !reducedMotion);
  const currentStep = player.current === null ? null : (steps[player.current] ?? null);

  const layout = useMemo(() => layoutDiagram(diagram), [diagram]);
  const { motions, onSlotMotionEnd } = useSlotMotion(slots);
  const nodes = useMemo(
    () => toFlowNodes(diagram, { slots, services, motions }),
    [diagram, slots, services, motions],
  );
  const edges = useMemo(
    () => toFlowEdges(diagram, layout, currentStep?.step ?? null),
    [diagram, layout, currentStep],
  );
  const namedSteps = useMemo(() => edgeSteps(diagram, services), [diagram, services]);
  const stepMarkers = useMemo(() => toStepMarkers(edges, namedSteps), [edges, namedSteps]);

  const duration = (ms: number) => (reducedMotion ? 0 : ms);
  const { width, height } = diagram.canvas;
  const fit = useCallback(
    (instance: Pick<ReactFlowInstance, "fitBounds">, animated: boolean) =>
      void instance.fitBounds(
        { x: 0, y: 0, width, height },
        { padding: FIT_PADDING, duration: animated && !reducedMotion ? 200 : 0 },
      ),
    [width, height, reducedMotion],
  );

  /**
   * Opening view: the fit, unless it would go below MIN_INITIAL_ZOOM; then the top-left of the
   * diagram at that zoom (viewport.ts). The reset button keeps the plain fit.
   */
  const opened = useRef(false);
  const open = useCallback(
    (instance: Pick<ReactFlowInstance, "fitBounds" | "setViewport">) => {
      // Only once per board: placing, clearing or accepting never moves the view (RF-PLAY-11).
      if (opened.current) return;
      opened.current = true;
      const board = boardRef.current;
      const view =
        board === null
          ? ({ kind: "fit" } as const)
          : initialView(
              diagram,
              { width: board.clientWidth, height: board.clientHeight },
              { padding: FIT_PADDING, minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM },
            );
      if (view.kind === "fit") fit(instance, false);
      else void instance.setViewport(view.viewport);
    },
    [diagram, fit],
  );

  const panBy = useCallback(
    (dx: number, dy: number, ms = 0) => {
      const { x, y, zoom } = flow.getViewport();
      void flow.setViewport(
        { x: x + dx, y: y + dy, zoom },
        { duration: ms, interpolate: "linear" },
      );
    },
    [flow],
  );

  useImperativeHandle(
    ref,
    () => ({
      playFlow: player.start,
      panBy: (dx, dy) => panBy(dx, dy, reducedMotion ? 0 : 200),
      element: () => boardRef.current,
    }),
    [player.start, panBy, reducedMotion],
  );

  const tabbing = useTabNavigation();
  const reveal = useCallback(
    (box: Box, renderedHeight?: number) => {
      const board = boardRef.current;
      // Only for Tab: a click lands on a slot already in view, and the focus the app moves back to
      // a slot after placing a service must not pan the board.
      if (board === null || !tabbing.current) return;
      const next = revealViewport(
        box,
        flow.getViewport(),
        { width: board.clientWidth, height: board.clientHeight },
        { renderedHeight, insetLeft },
      );
      // Linear: the default (smooth) transition zooms out and back in while it travels.
      if (next !== null) {
        void flow.setViewport(next, { duration: reducedMotion ? 0 : 200, interpolate: "linear" });
      }
    },
    [flow, reducedMotion, tabbing, insetLeft],
  );

  /** Arrows pan the board while the board itself (not a slot inside it) has the focus. */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [ARROW_PAN, 0],
      ArrowRight: [-ARROW_PAN, 0],
      ArrowUp: [0, ARROW_PAN],
      ArrowDown: [0, -ARROW_PAN],
    };
    const move = delta[event.key];
    if (move === undefined) return;
    event.preventDefault();
    panBy(move[0], move[1]);
  };

  const context = useMemo(
    (): DiagramContextValue => ({
      onSlotActivate,
      slotHintAction,
      droppable: onServiceDrop !== undefined,
      reveal,
      preview: false,
      print: false,
      printLabels: null,
      animate: !reducedMotion,
      onSlotMotionEnd,
      markers,
    }),
    [
      onSlotActivate,
      slotHintAction,
      onServiceDrop,
      reveal,
      reducedMotion,
      onSlotMotionEnd,
      markers,
    ],
  );

  const describedBy = [steps.length > 0 ? stepsId : null, helpId].filter(Boolean).join(" ");

  return (
    <DiagramContext.Provider value={context}>
      {onServiceDrop !== undefined && <DropMonitor onServiceDrop={onServiceDrop} />}
      <div data-slot="diagram" className={cn("flex min-h-0 flex-col", className)}>
        <div className="relative min-h-0 flex-1">
          <div
            ref={boardRef}
            role="group"
            aria-roledescription="diagrama"
            aria-label={label}
            aria-describedby={describedBy}
            // Focusable so the arrows can pan it (and so it can be scrolled with the keyboard).
            tabIndex={0}
            onKeyDown={onKeyDown}
            // Tabbing to a slot makes the browser scroll this overflow:hidden box to show it, which
            // shifts the board out of React Flow's control: pan with the viewport instead.
            onScroll={(event) => {
              event.currentTarget.scrollTop = 0;
              event.currentTarget.scrollLeft = 0;
            }}
            className="absolute inset-0 overflow-hidden bg-canvas focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring/55"
          >
            <ArrowMarkers markers={markers} />
            <ReactFlow<FlowNode, StepFlowEdge>
              {...STILL_CANVAS}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={open}
              onMove={(_, viewport) => onViewportChange?.(viewport)}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              // Pan always, at any zoom (problem 29): dragging the background, the wheel or two
              // fingers (Shift: horizontal). Zoom with the controls, Ctrl + wheel or a pinch.
              panOnDrag
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              zoomOnScroll={false}
              zoomOnPinch
              preventScrolling
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={18}
                size={1}
                color="var(--border)"
              />
              {/* Each step number opens its label, description and route (RF-PLAY-03). */}
              <StepMarkers markers={stepMarkers} interactive />
            </ReactFlow>
          </div>
          {/* One stack of floating controls, bottom-left: the player (while it runs) over the
              zoom. The app keeps its own floating content clear of it (data-slot). */}
          <div
            data-slot="board-controls"
            style={
              insetLeft > 0
                ? { left: insetLeft + 16, maxWidth: `calc(100% - ${insetLeft + 32}px)` }
                : undefined
            }
            className="pointer-events-none absolute bottom-4 left-4 z-10 flex max-w-[calc(100%-2rem)] flex-col items-start gap-2 *:pointer-events-auto"
          >
            <FlowPlayerControls
              player={player}
              steps={steps}
              current={currentStep}
              autoAdvance={!reducedMotion}
              playButton={playButton}
            />
            <ZoomControls onReset={() => fit(flow, true)} duration={duration(150)} />
          </div>
        </div>
        <StepList id={stepsId} steps={steps} current={currentStep} mode={stepList} />
        <p id={helpId} hidden>
          Flechas: desplazar el tablero. Ctrl + rueda o pellizco: zoom.
        </p>
      </div>
    </DiagramContext.Provider>
  );
}

/** Whether the last user input was the Tab key (a pointer press or any other key resets it). */
function useTabNavigation() {
  const tabbing = useRef(false);
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      tabbing.current = event.key === "Tab";
    };
    const onPointer = () => {
      tabbing.current = false;
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointer, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);
  return tabbing;
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      viewBox="0 0 10 10"
      refX="10"
      refY="5"
      markerWidth="10"
      markerHeight="10"
      markerUnits="userSpaceOnUse"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: color }} />
    </marker>
  );
}

function DropMonitor({
  onServiceDrop,
}: {
  onServiceDrop: (slotId: string, serviceId: string) => void;
}) {
  const listener = useMemo(
    () => ({
      onDragEnd: ({ active, over }: DragEndEvent) => {
        const slotId: unknown = over?.data.current?.slotId;
        const data: unknown = active.data.current;
        if (typeof slotId === "string" && isServiceDragData(data)) {
          onServiceDrop(slotId, data.serviceId);
        }
      },
    }),
    [onServiceDrop],
  );
  useDndMonitor(listener);
  return null;
}

const percent = new Intl.NumberFormat("es-AR", { style: "percent", maximumFractionDigits: 0 });

/** Floating card over the board, as .board-zoom in the prototype. */
const FLOATING =
  "rounded-md border bg-card shadow-[0_8px_24px_color-mix(in_oklab,var(--foreground)_10%,transparent)]";

function ZoomControls({
  onReset,
  duration,
  className,
}: {
  onReset: () => void;
  duration: number;
  className?: string;
}) {
  const { zoomTo } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  return (
    <div
      role="group"
      aria-label="Zoom"
      className={cn("flex items-center gap-[0.15rem] p-[0.15rem]", FLOATING, className)}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="Alejar"
        disabled={zoom <= MIN_ZOOM + 0.001}
        onClick={() => void zoomTo(steppedZoom(zoom, -1, MIN_ZOOM, MAX_ZOOM), { duration })}
      >
        <MinusIcon />
      </Button>
      <output
        aria-label="Nivel de zoom"
        className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums"
      >
        {percent.format(zoom)}
      </output>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Acercar"
        disabled={zoom >= MAX_ZOOM - 0.001}
        onClick={() => void zoomTo(steppedZoom(zoom, 1, MIN_ZOOM, MAX_ZOOM), { duration })}
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Ajustar a la pantalla"
        title="Ajustar a la pantalla"
        onClick={onReset}
      >
        <RotateCcwIcon />
      </Button>
    </div>
  );
}

/**
 * Flow player (RF-PLAY-03). Stopped: an optional "Reproducir flujo" button. Playing: a floating
 * card over the zoom controls with the current step and the controls. The live region is always
 * mounted, so the first step is announced too.
 */
function FlowPlayerControls({
  player,
  steps,
  current,
  autoAdvance,
  playButton,
}: {
  player: FlowPlayer;
  steps: readonly FlowStep[];
  current: FlowStep | null;
  autoAdvance: boolean;
  playButton: boolean;
}) {
  const live = (
    <p aria-live="polite" className="sr-only">
      {current !== null && describeStep(current, steps.length)}
    </p>
  );
  if (steps.length === 0) return null;
  if (player.current === null || current === null) {
    return (
      <>
        {live}
        {playButton && (
          <Button variant="outline" onClick={player.start} className={FLOATING}>
            <PlayIcon /> Reproducir flujo
          </Button>
        )}
      </>
    );
  }
  const first = player.current === 0;
  const last = player.current === steps.length - 1;
  return (
    <>
      {live}
      <div
        data-slot="flow-player"
        className={cn("flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2", FLOATING)}
      >
        <p aria-hidden="true" className="min-w-0 text-base">
          <strong className="mr-2 inline-grid size-6 place-items-center rounded-full bg-primary text-sm text-primary-foreground">
            {current.step}
          </strong>
          {current.labels.join(" / ")}
        </p>
        <div role="group" aria-label="Reproductor de flujo" className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Paso anterior"
            disabled={first}
            onClick={player.previous}
          >
            <ChevronLeftIcon />
          </Button>
          {autoAdvance &&
            (player.playing ? (
              <Button variant="outline" size="icon" aria-label="Pausar" onClick={player.pause}>
                <PauseIcon />
              </Button>
            ) : (
              <Button variant="outline" size="icon" aria-label="Reproducir" onClick={player.resume}>
                <PlayIcon />
              </Button>
            ))}
          <Button
            variant="outline"
            size="icon"
            aria-label="Paso siguiente"
            disabled={last}
            onClick={player.next}
          >
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon" aria-label="Detener" onClick={player.stop}>
            <SquareIcon />
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * Steps of the flow: the text alternative of the board (aria-describedby), with the route of each
 * step. `strip` also shows them under the board (Lovable: .flow-steps); `hidden` keeps them only
 * as the description.
 */
function StepList({
  id,
  steps,
  current,
  mode,
}: {
  id: string;
  steps: readonly FlowStep[];
  current: FlowStep | null;
  mode: "strip" | "hidden";
}) {
  if (steps.length === 0) return null;
  const items = steps.map((step) => {
    const active = step === current;
    const routes = step.routes.map(describeRoute).join("; ");
    return (
      <li
        key={step.step}
        data-step={step.step}
        aria-current={active ? "step" : undefined}
        title={[...step.descriptions, routes].filter(Boolean).join(" ") || undefined}
        className={cn(
          "flex items-center gap-[0.3rem] rounded-[5px] border bg-card px-[0.45rem] py-[0.3rem] text-sm text-muted-foreground",
          active && "border-primary text-primary",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "grid size-6 flex-none place-items-center rounded-full bg-muted text-xs font-[850] text-foreground",
            active && "bg-primary text-primary-foreground",
          )}
        >
          {step.step}
        </span>
        <span className="sr-only">Paso {step.step}: </span>
        {step.labels.join(" / ")}
        {(step.descriptions.length > 0 || routes !== "") && (
          <span className="sr-only">
            {" "}
            ({[routes, ...step.descriptions].filter(Boolean).join(". ")})
          </span>
        )}
      </li>
    );
  });
  if (mode === "hidden") {
    return (
      <ol id={id} hidden aria-label="Pasos del flujo">
        {items}
      </ol>
    );
  }
  return (
    <div className="flex-none border-t bg-background px-4 py-3">
      <ol id={id} aria-label="Pasos del flujo" className="flex flex-wrap gap-[0.35rem]">
        {items}
      </ol>
    </div>
  );
}
