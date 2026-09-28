// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Group } from "@blueprint/scenario-schema";
import { repeatedIdIndexes } from "../ids.js";
import { groupPath, nodePath } from "../scenario-helpers.js";
import type { Issue, IssuePath, Rule } from "../types.js";

const duplicateIds = (
  items: readonly { id: string }[],
  collection: string,
  basePath: IssuePath,
): Issue[] =>
  repeatedIdIndexes(items).map((i) => ({
    code: "L018",
    severity: "error",
    message: `El id "${items[i]?.id}" está repetido en ${collection}: cada id tiene que ser único.`,
    path: [...basePath, i, "id"],
  }));

/** Chains of `parent` that loop back, each reported once (from its smallest id). */
const nestingCycles = (groups: readonly Group[]): Issue[] => {
  const byId = new Map<string, Group>();
  for (const group of groups) if (!byId.has(group.id)) byId.set(group.id, group);
  const issues: Issue[] = [];
  groups.forEach((group, i) => {
    if (byId.get(group.id) !== group) return;
    const chain = [group.id];
    let current = group.parent ?? undefined;
    while (current !== undefined && current !== group.id && !chain.includes(current)) {
      chain.push(current);
      current = byId.get(current)?.parent ?? undefined;
    }
    if (current === group.id && chain.every((id) => group.id <= id)) {
      issues.push({
        code: "L018",
        severity: "error",
        message: `Los grupos forman un ciclo de anidamiento: ${[...chain, group.id].join(" → ")}.`,
        path: [...groupPath(i), "parent"],
      });
    }
  });
  return issues;
};

/**
 * Unique ids in objectives, groups, nodes and edges; node.group and group.parent point to
 * existing groups without nesting cycles. Other references live in their own rule:
 * answers[].objectives in L004, incorrect[].violates in L015, edge from/to in L006.
 */
export const l018: Rule = {
  code: "L018",
  description: "Ids únicos por colección y referencias a grupos válidas y sin ciclos.",
  check: ({ scenario }) => {
    const { groups, nodes, edges } = scenario.diagram;
    const groupIds = new Set(groups.map((group) => group.id));
    const missingGroup = (id: string, path: IssuePath, owner: string): Issue => ({
      code: "L018",
      severity: "error",
      message: `${owner} referencia el grupo "${id}", que no existe en diagram.groups.`,
      path,
    });
    return [
      ...duplicateIds(scenario.objectives, "objectives", ["objectives"]),
      ...duplicateIds(groups, "diagram.groups", ["diagram", "groups"]),
      ...duplicateIds(nodes, "diagram.nodes", ["diagram", "nodes"]),
      ...duplicateIds(edges, "diagram.edges", ["diagram", "edges"]),
      ...nodes.flatMap((node, i) =>
        node.group === undefined || groupIds.has(node.group)
          ? []
          : [missingGroup(node.group, [...nodePath(i), "group"], `El nodo "${node.id}"`)],
      ),
      ...groups.flatMap((group, i) => {
        const parent = group.parent ?? undefined;
        return parent === undefined || groupIds.has(parent)
          ? []
          : [missingGroup(parent, [...groupPath(i), "parent"], `El grupo "${group.id}"`)];
      }),
      ...nestingCycles(groups),
    ];
  },
};
