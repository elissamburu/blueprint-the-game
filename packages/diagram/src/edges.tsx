// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edge of the flow: a straight arrow between the node borders, with its step number in a 20 px
// circle on the free stretch of the edge (geometry.ts). The ends come from the YAML geometry,
// not from the React Flow handles. Lovable: .diagram-edges, .diagram-edge-label (src/styles.css).
import type { EdgeProps } from "@xyflow/react";
import { useDiagramContext } from "./context";
import type { StepFlowEdge } from "./flow-model";
import { STEP_RADIUS } from "./geometry";

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
  const { edge, segment, label, state } = data;
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
      {/* The number shows its step on hover (docs/design, layout v2). Hidden from assistive
          technologies: the step list of the board already says it. */}
      <g
        aria-hidden="true"
        data-step-label
        className="cursor-help"
        style={{ pointerEvents: "all" }}
      >
        <title>{`Paso ${edge.step}: ${edge.label}`}</title>
        <circle
          cx={label.x}
          cy={label.y}
          r={STEP_RADIUS}
          style={{
            fill: active ? "var(--primary)" : "var(--card)",
            stroke: active ? "var(--primary)" : "var(--foreground)",
            strokeWidth: 1,
          }}
        />
        <text
          x={label.x}
          y={label.y}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fill: active ? "var(--primary-foreground)" : "var(--foreground)",
            fontSize: 10,
            fontWeight: 850,
          }}
        >
          {edge.step}
        </text>
      </g>
    </g>
  );
}

export const edgeTypes = { step: StepEdge };
