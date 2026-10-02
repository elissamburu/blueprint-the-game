// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Step numbers of the edges (RF-PLAY-03): a 20 px circle on the free stretch of each edge
// (geometry.ts). On the board each one is a button that opens a popover with "Paso N", the label
// of the edge, its description and its route, as the hint popover of a slot does (HintAction).
// They live in the viewport portal of React Flow: after the nodes in the DOM, so Tab reaches them
// after the slots, and between the edges and the nodes on screen (Z.step), so a press area larger
// than the circle never takes a press from a node. A press on them never pans the board (NO_PAN).
import { Popover, PopoverContent, PopoverTrigger } from "@blueprint/ui/components/popover";
import { cn } from "@blueprint/ui/lib/utils";
import { useStore, ViewportPortal } from "@xyflow/react";
import { useId, useMemo } from "react";
import { Z, type StepEdgeState, type StepFlowEdge } from "./flow-model";
import { STEP_RADIUS, stepTargetDiameters, type Point } from "./geometry";
import { NO_PAN } from "./nodes";
import { describeRoute, type EdgeStep } from "./steps";

export interface StepMarker extends EdgeStep {
  /** Center of the circle, in canvas units. */
  point: Point;
  state: StepEdgeState;
}

/** The visible circle: card and foreground at rest, primary while the player is on its step. */
function StepCircle({ step, state }: { step: number; state: StepEdgeState }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: 2 * STEP_RADIUS, height: 2 * STEP_RADIUS }}
      className={cn(
        "grid place-items-center rounded-full border text-[10px] leading-none font-[850]",
        state === "active"
          ? "border-primary bg-primary text-primary-foreground"
          : "border-foreground bg-card text-foreground",
      )}
    >
      {step}
    </span>
  );
}

/** The circle of each drawn edge (those with a placed label), with its state in the player. */
export const toStepMarkers = (
  edges: readonly StepFlowEdge[],
  steps: readonly EdgeStep[],
): StepMarker[] => {
  const byEdge = new Map(steps.map((step) => [step.edgeId, step]));
  return edges.flatMap((edge) => {
    const step = edge.data === undefined ? undefined : byEdge.get(edge.data.edge.id);
    return edge.data === undefined || step === undefined
      ? []
      : [{ ...step, point: edge.data.label, state: edge.data.state }];
  });
};

const zoomOf = (s: { transform: [number, number, number] }) => s.transform[2];

/**
 * The step circles of the board. `interactive`: buttons with their popover; otherwise (the
 * preview) only the circles.
 */
export function StepMarkers({
  markers,
  interactive,
}: {
  markers: readonly StepMarker[];
  interactive: boolean;
}) {
  const zoom = useStore(zoomOf);
  const points = useMemo(() => markers.map((m) => m.point), [markers]);
  const diameters = useMemo(() => stepTargetDiameters(points, zoom), [points, zoom]);
  return (
    <ViewportPortal>
      {markers.map((marker, i) => {
        const size = interactive ? (diameters[i] ?? 2 * STEP_RADIUS) : 2 * STEP_RADIUS;
        return (
          <div
            key={marker.edgeId}
            data-step-label={marker.step}
            data-step-edge={marker.edgeId}
            data-state={marker.state}
            style={{
              position: "absolute",
              left: marker.point.x - size / 2,
              top: marker.point.y - size / 2,
              width: size,
              height: size,
              zIndex: Z.step,
            }}
            className={cn(
              "grid place-items-center",
              interactive ? "pointer-events-auto" : "pointer-events-none",
              marker.state === "dimmed" && "opacity-35",
            )}
          >
            {interactive ? (
              <StepButton marker={marker} />
            ) : (
              <StepCircle step={marker.step} state={marker.state} />
            )}
          </div>
        );
      })}
    </ViewportPortal>
  );
}

function StepButton({ marker }: { marker: StepMarker }) {
  const titleId = useId();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={marker.name}
          // The whole press area (at least 24 × 24 px on screen) around the 20 px circle.
          className={cn(
            NO_PAN,
            "grid size-full cursor-pointer place-items-center rounded-full",
            "focus-visible:outline-3 focus-visible:outline-offset-0 focus-visible:outline-ring/55",
            "[&:hover>span]:ring-2 [&:hover>span]:ring-primary/40",
          )}
        >
          <StepCircle step={marker.step} state={marker.state} />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={titleId} side="bottom" className="w-80 border-primary">
        <h3 id={titleId} className="flex items-center gap-2 text-sm font-bold">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-blueprint-soft text-sm font-bold text-primary"
          >
            {marker.step}
          </span>
          Paso {marker.step}
        </h3>
        <p className="mt-3 text-base font-semibold">{marker.label}</p>
        {marker.description !== undefined && (
          <p className="mt-1 text-sm text-muted-foreground">{marker.description}</p>
        )}
        <p className="mt-3 text-sm">
          <span className="sr-only">Recorrido: </span>
          {describeRoute(marker.route)}
        </p>
      </PopoverContent>
    </Popover>
  );
}
