// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edits of the diagram that the form (and the visual editor of PR 5) make with more than one
// command, as one transaction: the steps of the edges and the removal of nodes and groups. Pure:
// they read the raw document and return the commands.
import type { EditCommand } from "./document-edit";
import { listOf, recordOf, textOf } from "./form-data";

const edgesOf = (raw: unknown) => listOf(recordOf(recordOf(raw).diagram).edges).map(recordOf);
const nodesOf = (raw: unknown) => listOf(recordOf(recordOf(raw).diagram).nodes).map(recordOf);
const groupsOf = (raw: unknown) => listOf(recordOf(recordOf(raw).diagram).groups).map(recordOf);

/** The steps as 1..n without gaps, keeping their order and the edges that share a step. */
export const normalizeSteps = (steps: readonly number[]): number[] => {
  const distinct = [...new Set(steps)].sort((a, b) => a - b);
  return steps.map((step) => distinct.indexOf(step) + 1);
};

export type StepDirection = -1 | 1;

/**
 * Moving an edge one place in the flow: up is one step earlier, down one step later, and the
 * steps are numbered again without gaps. An edge alone in its step joins the neighbor step (in
 * parallel); an edge that shares its step goes alone before or after the others.
 */
export const moveStep = (
  steps: readonly number[],
  index: number,
  direction: StepDirection,
): number[] => normalizeSteps(steps.map((step, at) => (at === index ? step + direction : step)));

/** False when the move changes nothing: alone in the first step (up) or in the last (down). */
export const canMoveStep = (
  steps: readonly number[],
  index: number,
  direction: StepDirection,
): boolean => {
  const step = steps[index];
  if (step === undefined) return false;
  const moved = moveStep(steps, index, direction);
  return moved.some((value, at) => value !== normalizeSteps(steps)[at]);
};

const stepOf = (value: unknown): number => {
  const step = Number(value);
  return Number.isFinite(step) ? step : 0;
};

/** Commands that set the steps after moving the edge at `index`; only the steps that change. */
export const stepCommands = (
  raw: unknown,
  index: number,
  direction: StepDirection,
): { commands: EditCommand[]; step: number; parallel: string[] } => {
  const edges = edgesOf(raw);
  const steps = edges.map((edge) => stepOf(edge.step));
  const moved = moveStep(steps, index, direction);
  const step = moved[index] ?? 0;
  return {
    commands: moved.flatMap((value, at) =>
      value === steps[at]
        ? []
        : [{ op: "set" as const, path: ["diagram", "edges", at, "step"], value }],
    ),
    step,
    parallel: edges
      .filter((_, at) => at !== index && moved[at] === step)
      .map((edge) => textOf(edge.id)),
  };
};

/** The edges that start or end in the node at `index` (removed with it). */
export const edgesOfNode = (raw: unknown, index: number): number[] => {
  const id = textOf(nodesOf(raw)[index]?.id);
  return edgesOf(raw).flatMap((edge, at) =>
    id !== "" && (edge.from === id || edge.to === id) ? [at] : [],
  );
};

/** Removes the node at `index` and its edges, as one edit (the last indices first). */
export const removeNodeCommands = (raw: unknown, index: number): EditCommand[] => [
  ...edgesOfNode(raw, index)
    .reverse()
    .map((at): EditCommand => ({ op: "remove", path: ["diagram", "edges", at] })),
  { op: "remove", path: ["diagram", "nodes", index] },
];

/**
 * Removes the group at `index`: its nodes stay without a group and its child groups go up to
 * its parent, so no reference is left pointing to it.
 */
export const removeGroupCommands = (raw: unknown, index: number): EditCommand[] => {
  const groups = groupsOf(raw);
  const group = groups[index];
  const id = textOf(group?.id);
  const parent = group?.parent;
  return [
    ...nodesOf(raw).flatMap((node, at): EditCommand[] =>
      id !== "" && node.group === id
        ? [{ op: "set", path: ["diagram", "nodes", at, "group"], value: undefined }]
        : [],
    ),
    ...groups.flatMap((child, at): EditCommand[] =>
      id !== "" && at !== index && child.parent === id
        ? [
            {
              op: "set",
              path: ["diagram", "groups", at, "parent"],
              value: typeof parent === "string" ? parent : null,
            },
          ]
        : [],
    ),
    { op: "remove", path: ["diagram", "groups", index] },
  ];
};
