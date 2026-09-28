// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Traversals of a scenario shared by several rules.
import type { Scenario, SlotNode } from "@blueprint/scenario-schema";
import type { IssuePath } from "./types.js";

export const nodePath = (index: number): IssuePath => ["diagram", "nodes", index];
export const groupPath = (index: number): IssuePath => ["diagram", "groups", index];
export const edgePath = (index: number): IssuePath => ["diagram", "edges", index];

export interface IndexedSlot {
  slot: SlotNode;
  index: number;
  path: IssuePath;
}

export const slotsOf = (scenario: Scenario): IndexedSlot[] =>
  scenario.diagram.nodes.flatMap((node, index) =>
    node.type === "slot" ? [{ slot: node, index, path: nodePath(index) }] : [],
  );

export type ServiceUseKind = "fixed" | "optimal" | "acceptable" | "incorrect" | "extra";

export interface ServiceUse {
  service: string;
  kind: ServiceUseKind;
  path: IssuePath;
}

/** Every place where the scenario names a catalog service, in document order. */
export const serviceUses = (scenario: Scenario): ServiceUse[] => {
  const uses: ServiceUse[] = [];
  scenario.diagram.nodes.forEach((node, index) => {
    if (node.type === "fixed") {
      uses.push({ service: node.service, kind: "fixed", path: [...nodePath(index), "service"] });
    }
    if (node.type !== "slot") return;
    node.answers.forEach((answer, j) =>
      uses.push({
        service: answer.service,
        kind: answer.grade,
        path: [...nodePath(index), "answers", j, "service"],
      }),
    );
    node.incorrect.forEach((incorrect, j) =>
      uses.push({
        service: incorrect.service,
        kind: "incorrect",
        path: [...nodePath(index), "incorrect", j, "service"],
      }),
    );
  });
  scenario.palette?.extra.forEach((service, j) =>
    uses.push({ service, kind: "extra", path: ["palette", "extra", j] }),
  );
  return uses;
};

/** Human-readable plural: `1 casillero`, `3 casilleros`. */
export const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;
