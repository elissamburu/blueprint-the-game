// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edge of the flow: a straight arrow between the node borders, with its step number in a 20 px
// circle on the free stretch of the edge (geometry.ts). The ends come from the YAML geometry,
// not from the React Flow handles. Lovable: .diagram-edges, .diagram-edge-label (src/styles.css).
import type { EdgeStyle } from "@blueprint/scenario-schema";
import type { EdgeProps } from "@xyflow/react";
import { useDiagramContext } from "./context";
import type { StepFlowEdge } from "./flow-model";
import { STEP_RADIUS } from "./geometry";

/** Dash pattern by edge style (docs/03 §2: sync | async | data | control). */
const DASH: Record<EdgeStyle, string | undefined> = {
  sync: undefined,
  async: "7 5",
  data: undefined,
  control: "2 4",
};

export function StepEdge({ id, data }: EdgeProps<StepFlowEdge>) {
  const { animate, markers } = useDiagramContext();
  if (data === undefined) return null;
  const { edge, segment, label, state } = data;
  const active = state === "active";
  const { start, end } = segment;
  const width = edge.style === "data" ? 2 : 1.5;
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
        style={{
          stroke: active ? "var(--primary)" : "var(--muted-foreground)",
          strokeWidth: active ? width + 1 : width,
          // Moving dashes show the direction while the step plays; still, the arrow does.
          strokeDasharray: active && animate ? "8 6" : DASH[edge.style],
        }}
      >
        {active && animate && (
          <animate
            attributeName="stroke-dashoffset"
            from="28"
            to="0"
            dur="0.8s"
            repeatCount="indefinite"
          />
        )}
      </path>
      <g aria-hidden="true">
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
