// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { NODE_SIZE, type DiagramNode, type Group } from "@blueprint/scenario-schema";
import { groupPath, nodePath } from "../scenario-helpers.js";
import type { Issue, Rule } from "../types.js";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Box of a node: `position` is its top-left corner, size comes from NODE_SIZE. */
export const nodeBox = (node: DiagramNode): Box => ({ ...node.position, ...NODE_SIZE[node.type] });

/** `inner` lies completely inside `outer` (touching the border counts as inside). */
export const contains = (outer: Box, inner: Box): boolean =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

/** The boxes share some area (sharing only a border is not an overlap). */
export const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const area = (box: Box): number => box.w * box.h;

/**
 * Errors: node or group outside the canvas, node outside its group, child group outside
 * its parent, overlapping nodes. Warnings: overlapping sibling groups, a node without
 * `group` drawn inside a group. Missing groups are reported by L018 and skipped here.
 */
export const l007: Rule = {
  code: "L007",
  description: "Nodos y grupos dentro del canvas y de sus grupos, sin nodos superpuestos.",
  check: ({ scenario }) => {
    const { canvas, groups, nodes } = scenario.diagram;
    const canvasBox: Box = { x: 0, y: 0, w: canvas.width, h: canvas.height };
    const groupsById = new Map<string, Group>();
    for (const group of groups) if (!groupsById.has(group.id)) groupsById.set(group.id, group);
    const issues: Issue[] = [];
    const error = (message: string, path: Issue["path"]) =>
      issues.push({ code: "L007", severity: "error", message, path });
    const warning = (message: string, path: Issue["path"]) =>
      issues.push({ code: "L007", severity: "warning", message, path });
    const canvasSize = `${canvas.width}×${canvas.height}`;

    groups.forEach((group, i) => {
      if (!contains(canvasBox, group.rect)) {
        error(`El grupo "${group.id}" se sale del canvas (${canvasSize}).`, [
          ...groupPath(i),
          "rect",
        ]);
      }
      const parentId = group.parent ?? undefined;
      const parent = parentId === undefined ? undefined : groupsById.get(parentId);
      if (parent !== undefined && parent !== group && !contains(parent.rect, group.rect)) {
        error(
          `El grupo "${group.id}" no está completamente dentro del rect de su grupo padre "${parent.id}".`,
          [...groupPath(i), "rect"],
        );
      }
      groups.slice(0, i).forEach((other) => {
        if ((other.parent ?? null) === (group.parent ?? null) && overlaps(other.rect, group.rect)) {
          warning(
            `El grupo "${group.id}" se superpone con su grupo hermano "${other.id}". Si no es intencional (p. ej. un grupo transversal), separalos.`,
            [...groupPath(i), "rect"],
          );
        }
      });
    });

    const boxes = nodes.map(nodeBox);
    nodes.forEach((node, i) => {
      const box = boxes[i] as Box;
      const size = `${box.w}×${box.h}`;
      if (!contains(canvasBox, box)) {
        error(
          `El nodo "${node.id}" (caja de ${size} en ${box.x},${box.y}) se sale del canvas (${canvasSize}).`,
          [...nodePath(i), "position"],
        );
      }
      if (node.group !== undefined) {
        const group = groupsById.get(node.group);
        if (group !== undefined && !contains(group.rect, box)) {
          error(
            `El nodo "${node.id}" (caja de ${size} en ${box.x},${box.y}) no está completamente dentro del rect de su grupo "${group.id}".`,
            [...nodePath(i), "position"],
          );
        }
      } else {
        const enclosing = groups
          .filter((group) => contains(group.rect, box))
          .sort((a, b) => area(a.rect) - area(b.rect))[0];
        if (enclosing !== undefined) {
          warning(
            `El nodo "${node.id}" se dibuja dentro del grupo "${enclosing.id}" pero no tiene group: ¿falta group: ${enclosing.id}?`,
            nodePath(i),
          );
        }
      }
      nodes.slice(0, i).forEach((other, j) => {
        if (overlaps(boxes[j] as Box, box)) {
          error(`El nodo "${node.id}" se superpone con el nodo "${other.id}".`, [
            ...nodePath(i),
            "position",
          ]);
        }
      });
    });
    return issues;
  },
};
