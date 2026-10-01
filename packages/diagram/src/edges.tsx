// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edge of the flow: a straight arrow between the node borders. Its step number is a circle on the
// free stretch of the edge, drawn by StepMarkers (a button on the board). The ends come from the
// YAML geometry, not from the React Flow handles. Lovable: .diagram-edges (src/styles.css).
import type { EdgeProps } from "@xyflow/react";
import { useDiagramContext } from "./context";
import type { StepFlowEdge } from "./flow-model";

/**
 * Line of an edge, as .diagram-edges line in the prototype: thin, dotted and faint at rest; primary
 * and moving only while the flow player is on its step. Widths do not scale with the zoom. The
 * opacity goes on the stroke only, so the arrowhead (a marker) keeps its full color.
 */
const LINE = {
  idle: { stroke: "var(--muted-foreground)", width: 1, dash: "4 3", opacity: 0.58 },
  active: { stroke: "var(--primary)", width: 1.75, dash: "6 3", opacity: 1 },
} as const;
/** Length of the active dash pattern: the animation shifts it by whole periods. */
const ACTIVE_PERIOD = 9;

export function StepEdge({ id, data }: EdgeProps<StepFlowEdge>) {
  const { animate, markers } = useDiagramContext();
  if (data === undefined) return null;
  const { edge, segment, state } = data;
  const active = state === "active";
  const { start, end } = segment;
  const line = active ? LINE.active : LINE.idle;
  return (
    <g
      data-edge-id={edge.id}
      data-step={edge.step}
      data-state={state}
      className={state === "dimmed" ? "opacity-35" : undefined}
    >
      <path
        id={id}
        d={`M ${start.x},${start.y} L ${end.x},${end.y}`}
        fill="none"
        markerEnd={`url(#${active ? markers.active : markers.idle})`}
        vectorEffect="non-scaling-stroke"
        style={{
          stroke: line.stroke,
          strokeWidth: line.width,
          strokeDasharray: line.dash,
          strokeOpacity: line.opacity,
        }}
      >
        {/* Moving dashes show the direction while the step plays; still, the arrow does. */}
        {active && animate && (
          <animate
            attributeName="stroke-dashoffset"
            from={ACTIVE_PERIOD * 2}
            to="0"
            dur="0.8s"
            repeatCount="indefinite"
          />
        )}
      </path>
    </g>
  );
}

export const edgeTypes = { step: StepEdge };
