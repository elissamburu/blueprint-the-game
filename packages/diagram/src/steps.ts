// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Steps of the flow player (RF-PLAY-03): the edges grouped by `step`. Edges with the same step
// run in parallel, so they form one step; repeated labels (the same call from two zones) are
// shown once.
import type { Edge } from "@blueprint/scenario-schema";

export interface FlowStep {
  step: number;
  edgeIds: readonly string[];
  /** Distinct labels of the step, in diagram order. */
  labels: readonly string[];
  /** Distinct descriptions of the step, in diagram order. */
  descriptions: readonly string[];
}

const distinct = (values: readonly (string | undefined)[]): string[] => [
  ...new Set(values.filter((v): v is string => v !== undefined && v !== "")),
];

export const flowSteps = (edges: readonly Edge[]): FlowStep[] => {
  const byStep = new Map<number, Edge[]>();
  for (const edge of edges) byStep.set(edge.step, [...(byStep.get(edge.step) ?? []), edge]);
  return [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, group]) => ({
      step,
      edgeIds: group.map((e) => e.id),
      labels: distinct(group.map((e) => e.label)),
      descriptions: distinct(group.map((e) => e.description)),
    }));
};

/** One line per step for screen readers and the current-step announcement. */
export const describeStep = (step: FlowStep, total: number): string =>
  [`Paso ${step.step} de ${total}: ${step.labels.join(" / ")}.`, ...step.descriptions].join(" ");
