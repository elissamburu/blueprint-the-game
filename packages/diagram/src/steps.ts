// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Steps of the flow player (RF-PLAY-03): the edges grouped by `step`. Edges with the same step
// run in parallel, so they form one step; repeated labels (the same call from two zones) are
// shown once. Each step also lists its routes ("origin → destination"), which make the list the
// text alternative of the board.
import type { DiagramNode, Edge } from "@blueprint/scenario-schema";
import type { ServiceLookup } from "./types";

export interface StepRoute {
  from: string;
  to: string;
}

export interface FlowStep {
  step: number;
  edgeIds: readonly string[];
  /** Distinct labels of the step, in diagram order. */
  labels: readonly string[];
  /** Distinct descriptions of the step, in diagram order. */
  descriptions: readonly string[];
  /** Distinct routes of the step, in diagram order (empty without a node lookup). */
  routes: readonly StepRoute[];
}

const distinct = (values: readonly (string | undefined)[]): string[] => [
  ...new Set(values.filter((v): v is string => v !== undefined && v !== "")),
];

/**
 * How a node is named in the steps: actors and external systems by their label, fixed nodes by
 * their service and slots by their role. Never by the hidden service of a slot (RF-PLAY-02).
 */
export const nodeName = (node: DiagramNode, services: ServiceLookup): string => {
  switch (node.type) {
    case "actor":
    case "external":
      return node.label;
    case "fixed":
      return services(node.service)?.name ?? node.service;
    case "slot":
      return node.role.trim().replace(/\.+$/, "");
  }
};

export const flowSteps = (
  edges: readonly Edge[],
  nameOf?: (nodeId: string) => string,
): FlowStep[] => {
  const byStep = new Map<number, Edge[]>();
  for (const edge of edges) byStep.set(edge.step, [...(byStep.get(edge.step) ?? []), edge]);
  return [...byStep.entries()]
    .sort(([a], [b]) => a - b)
    .map(([step, group]) => {
      const routes = new Map<string, StepRoute>();
      if (nameOf !== undefined) {
        for (const edge of group) {
          const route = { from: nameOf(edge.from), to: nameOf(edge.to) };
          routes.set(`${route.from}\u0000${route.to}`, route);
        }
      }
      return {
        step,
        edgeIds: group.map((e) => e.id),
        labels: distinct(group.map((e) => e.label)),
        descriptions: distinct(group.map((e) => e.description)),
        routes: [...routes.values()],
      };
    });
};

/** Steps of a diagram with their routes named after the nodes (see `nodeName`). */
export const diagramSteps = (
  diagram: { nodes: readonly DiagramNode[]; edges: readonly Edge[] },
  services: ServiceLookup,
): FlowStep[] => {
  const nodes = new Map(diagram.nodes.map((n) => [n.id, n]));
  return flowSteps(diagram.edges, (id) => {
    const node = nodes.get(id);
    return node === undefined ? id : nodeName(node, services);
  });
};

/** "Visitantes → Servicio que resuelve el dominio" (one line per route). */
export const describeRoute = (route: StepRoute): string => `${route.from} → ${route.to}`;

/** One line per step for screen readers and the current-step announcement. */
export const describeStep = (step: FlowStep, total: number): string =>
  [`Paso ${step.step} de ${total}: ${step.labels.join(" / ")}.`, ...step.descriptions].join(" ");
