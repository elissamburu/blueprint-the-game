// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Board of a scenario (RF-PLAY-02, RF-PLAY-03, RF-PLAY-11): the `diagram` block drawn with React
// Flow at the YAML positions, zoom controls, the flow player and the step strip below. It does not
// decide grades nor import game-engine: slot states come in by props and it only emits events
// (ADR-0008: the app turns them into engine commands).
// Lovable: .board-toolbar, .zoom-controls, .architecture-board, .flow-steps (src/styles.css).
import "@xyflow/react/dist/base.css";
import { Button } from "@blueprint/ui/components/button";
import type { Diagram as DiagramData } from "@blueprint/scenario-schema";
import { cn } from "@blueprint/ui/lib/utils";
import { useDndMonitor, type DragEndEvent } from "@dnd-kit/core";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type ReactFlowInstance,
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
import { useCallback, useId, useMemo, useRef, type ReactNode } from "react";
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
import { nodeTypes } from "./nodes";
import { describeStep, flowSteps, type FlowStep } from "./steps";
import { isServiceDragData, type ServiceLookup, type SlotView } from "./types";
import { useFlowPlayer, type FlowPlayer } from "./use-flow-player";
import { useReducedMotion } from "./use-reduced-motion";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 2;
const FIT_PADDING = 0.04;
/** Margin (px) a focused slot keeps from the edges of the board before it pans. */
const REVEAL_MARGIN = 16;

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
   * undefined to keep the counter.
   */
  slotHintAction?: ((slotId: string) => ReactNode) | undefined;
  /** Accessible name of the board. */
  label?: string | undefined;
  /** Left side of the toolbar (e.g. the progress status of the game). */
  toolbarStart?: ReactNode;
  className?: string | undefined;
}

export function Diagram(props: DiagramProps) {
  return (
    <ReactFlowProvider>
      <DiagramBoard {...props} />
    </ReactFlowProvider>
  );
}

function DiagramBoard({
  diagram,
  services,
  slots,
  onSlotActivate,
  onServiceDrop,
  slotHintAction,
  label = "Diagrama de la arquitectura",
  toolbarStart,
  className,
}: DiagramProps) {
  const reducedMotion = useReducedMotion();
  const flow = useReactFlow<FlowNode, StepFlowEdge>();
  const boardRef = useRef<HTMLDivElement>(null);
  const stripId = useId();
  const markerId = useId();
  const markers = useMemo(
    () => ({ idle: `${markerId}-idle`, active: `${markerId}-active` }),
    [markerId],
  );

  const steps = useMemo(() => flowSteps(diagram.edges), [diagram.edges]);
  const player = useFlowPlayer(steps.length, !reducedMotion);
  const currentStep = player.current === null ? null : (steps[player.current] ?? null);

  const layout = useMemo(() => layoutDiagram(diagram), [diagram]);
  const nodes = useMemo(
    () => toFlowNodes(diagram, { slots, services }),
    [diagram, slots, services],
  );
  const edges = useMemo(
    () => toFlowEdges(diagram, layout, currentStep?.step ?? null),
    [diagram, layout, currentStep],
  );

  const { width, height } = diagram.canvas;
  const fit = useCallback(
    (instance: Pick<ReactFlowInstance, "fitBounds">, animated: boolean) =>
      void instance.fitBounds(
        { x: 0, y: 0, width, height },
        { padding: FIT_PADDING, duration: animated && !reducedMotion ? 200 : 0 },
      ),
    [width, height, reducedMotion],
  );

  const reveal = useCallback(
    (box: Box) => {
      const board = boardRef.current;
      if (board === null) return;
      const { x, y, zoom } = flow.getViewport();
      const left = box.x * zoom + x;
      const top = box.y * zoom + y;
      const inView =
        left >= REVEAL_MARGIN &&
        top >= REVEAL_MARGIN &&
        left + box.w * zoom <= board.clientWidth - REVEAL_MARGIN &&
        top + box.h * zoom <= board.clientHeight - REVEAL_MARGIN;
      if (inView) return;
      void flow.setCenter(box.x + box.w / 2, box.y + box.h / 2, {
        zoom,
        duration: reducedMotion ? 0 : 200,
      });
    },
    [flow, reducedMotion],
  );

  const context = useMemo(
    (): DiagramContextValue => ({
      onSlotActivate,
      slotHintAction,
      droppable: onServiceDrop !== undefined,
      reveal,
      animate: !reducedMotion,
      markers,
    }),
    [onSlotActivate, slotHintAction, onServiceDrop, reveal, reducedMotion, markers],
  );

  return (
    <DiagramContext.Provider value={context}>
      {onServiceDrop !== undefined && <DropMonitor onServiceDrop={onServiceDrop} />}
      <div data-slot="diagram" className={cn("flex min-h-0 flex-col", className)}>
        <div className="grid min-h-14 flex-none grid-cols-[1fr_auto_1fr] items-center gap-4 border-b bg-background px-4 text-[0.75rem] font-bold">
          <div className="min-w-0">{toolbarStart}</div>
          <ZoomControls onReset={() => fit(flow, true)} animate={!reducedMotion} />
          <div className="flex justify-end">
            <PlayerControls player={player} steps={steps} autoAdvance={!reducedMotion} />
          </div>
        </div>
        <div
          ref={boardRef}
          role="group"
          aria-roledescription="diagrama"
          aria-label={label}
          aria-describedby={steps.length > 0 ? stripId : undefined}
          // Tabbing to a slot makes the browser scroll this overflow:hidden box to show it, which
          // shifts the board out of React Flow's control: pan with the viewport instead.
          onScroll={(event) => {
            event.currentTarget.scrollTop = 0;
            event.currentTarget.scrollLeft = 0;
          }}
          className="relative min-h-0 flex-1 overflow-hidden bg-canvas"
        >
          <svg aria-hidden="true" width="0" height="0" className="absolute">
            <defs>
              <ArrowMarker id={markers.idle} color="var(--muted-foreground)" />
              <ArrowMarker id={markers.active} color="var(--primary)" />
            </defs>
          </svg>
          <ReactFlow<FlowNode, StepFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            zIndexMode="manual"
            onInit={(instance) => fit(instance, false)}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            // Read-only canvas: nothing is dragged, connected, selected or deleted.
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable={false}
            disableKeyboardA11y
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            panActivationKeyCode={null}
            // Pan by dragging the background; zoom with the controls, pinch or Ctrl + wheel. The
            // plain wheel scrolls the page instead of zooming by surprise.
            panOnDrag
            zoomOnScroll={false}
            zoomOnPinch
            zoomOnDoubleClick={false}
            preventScrolling={false}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--border)" />
          </ReactFlow>
        </div>
        <StepStrip id={stripId} steps={steps} current={currentStep} />
      </div>
    </DiagramContext.Provider>
  );
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

function ZoomControls({ onReset, animate }: { onReset: () => void; animate: boolean }) {
  const { zoomIn, zoomOut } = useReactFlow();
  const zoom = useStore((s) => s.transform[2]);
  const duration = animate ? 150 : 0;
  return (
    <div
      role="group"
      aria-label="Zoom"
      className="flex items-center gap-[0.15rem] rounded-md border bg-card p-[0.15rem]"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Alejar"
        disabled={zoom <= MIN_ZOOM + 0.001}
        onClick={() => void zoomOut({ duration })}
      >
        <MinusIcon />
      </Button>
      <output aria-label="Nivel de zoom" className="min-w-12 text-center tabular-nums">
        {percent.format(zoom)}
      </output>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Acercar"
        disabled={zoom >= MAX_ZOOM - 0.001}
        onClick={() => void zoomIn({ duration })}
      >
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label="Restablecer zoom (ajustar a la pantalla)"
        onClick={onReset}
      >
        <RotateCcwIcon />
      </Button>
    </div>
  );
}

function PlayerControls({
  player,
  steps,
  autoAdvance,
}: {
  player: FlowPlayer;
  steps: readonly FlowStep[];
  autoAdvance: boolean;
}) {
  if (steps.length === 0) return null;
  if (player.current === null) {
    return (
      <Button variant="outline" onClick={player.start}>
        <PlayIcon /> Reproducir flujo
      </Button>
    );
  }
  const first = player.current === 0;
  const last = player.current === steps.length - 1;
  return (
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
  );
}

/** Lovable: .flow-steps. Also the text alternative of the board (aria-describedby). */
function StepStrip({
  id,
  steps,
  current,
}: {
  id: string;
  steps: readonly FlowStep[];
  current: FlowStep | null;
}) {
  if (steps.length === 0) return null;
  return (
    <div className="flex-none border-t bg-background px-4 py-3">
      <ol id={id} aria-label="Pasos del flujo" className="flex flex-wrap gap-[0.35rem]">
        {steps.map((step) => {
          const active = step === current;
          return (
            <li
              key={step.step}
              data-step={step.step}
              aria-current={active ? "step" : undefined}
              title={step.descriptions.join(" ") || undefined}
              className={cn(
                "flex items-center gap-[0.3rem] rounded-[5px] border bg-card px-[0.45rem] py-[0.3rem] text-[0.65rem] text-muted-foreground",
                active && "border-primary text-primary",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-[16px] flex-none place-items-center rounded-full bg-muted text-[0.6rem] font-[850] text-foreground",
                  active && "bg-primary text-primary-foreground",
                )}
              >
                {step.step}
              </span>
              <span className="sr-only">Paso {step.step}: </span>
              {step.labels.join(" / ")}
              {step.descriptions.length > 0 && (
                <span className="sr-only"> ({step.descriptions.join(" ")})</span>
              )}
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className="mt-2 min-h-[1.2rem] text-[0.72rem] text-foreground">
        {current !== null && describeStep(current, steps.length)}
      </p>
    </div>
  );
}
