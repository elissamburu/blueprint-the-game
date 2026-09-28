// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { edgePath } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

/** The schema already requires `step` to be an integer ≥ 1. */
export const l006: Rule = {
  code: "L006",
  description: "Las aristas unen nodos existentes y sus pasos van de 1 a n sin huecos.",
  check: ({ scenario }) => {
    const { nodes, edges } = scenario.diagram;
    const nodeIds = new Set(nodes.map((node) => node.id));
    const issues: Issue[] = [];
    edges.forEach((edge, index) => {
      for (const end of ["from", "to"] as const) {
        if (!nodeIds.has(edge[end])) {
          issues.push({
            code: "L006",
            severity: "error",
            message: `La arista "${edge.id}" tiene ${end}: "${edge[end]}", que no es un nodo del diagrama.`,
            path: [...edgePath(index), end],
          });
        }
      }
    });
    const steps = new Set(edges.map((edge) => edge.step));
    const last = Math.max(0, ...steps);
    const missing = Array.from({ length: last }, (_, i) => i + 1).filter(
      (step) => !steps.has(step),
    );
    if (missing.length > 0) {
      issues.push({
        code: "L006",
        severity: "error",
        message: `Los pasos de las aristas tienen huecos: ${missing.length === 1 ? "falta el paso" : "faltan los pasos"} ${missing.join(", ")}. Tienen que ser consecutivos desde 1.`,
        path: ["diagram", "edges"],
      });
    }
    return issues;
  },
};
