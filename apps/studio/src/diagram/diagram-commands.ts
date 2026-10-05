// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The commands of the visual editor (@blueprint/diagram, by id) as edit commands of the document
// (by path), the same ones the form makes (ADR-0025 §2): `setIn` of each scalar that changes,
// `append` of a new element, the removals of diagram-edit.ts. Pure. Ids are looked up in the raw
// document of the moment, so an element renamed or removed in the YAML meanwhile is never edited
// by a stale index.
import type { DiagramCommand, DiagramSelection, Placement } from "@blueprint/diagram/editor";
import { EditError, type EditCommand, type EditPath } from "../form/document-edit";
import {
  newEdge,
  newGroup,
  newNode,
  removeGroupCommands,
  removeNodeCommands,
  stepCommands,
} from "../form/diagram-edit";
import { listOf, recordOf, textOf, type RawRecord } from "../form/form-data";

export type DiagramList = "groups" | "nodes" | "edges";

export const LISTS: Record<DiagramSelection["kind"], DiagramList> = {
  group: "groups",
  node: "nodes",
  edge: "edges",
};

export const itemsOf = (raw: unknown, list: DiagramList): RawRecord[] =>
  listOf(recordOf(recordOf(raw).diagram)[list]).map(recordOf);

/** Index of the element in its list of the raw document (the first with the id), or -1. */
export const indexOf = (raw: unknown, selection: DiagramSelection): number =>
  itemsOf(raw, LISTS[selection.kind]).findIndex((item) => item.id === selection.id);

/** Path of the element in the document; an EditError if it is not there. */
export const pathOf = (raw: unknown, selection: DiagramSelection): EditPath => {
  const index = indexOf(raw, selection);
  if (index === -1) throw new EditError(`«${selection.id}» ya no está en el diagrama`);
  return ["diagram", LISTS[selection.kind], index];
};

export interface Translation {
  commands: EditCommand[];
  /** An undo step of its own (everything but a press of an arrow). */
  isolate: boolean;
  /** The element to select after the edit: the new one. */
  select?: DiagramSelection;
  /** The step of the edge after `moveStep`. */
  step?: number;
}

const NOTHING: Translation = { commands: [], isolate: true };

const setIfChanged = (
  path: EditPath,
  current: unknown,
  value: string | number | null | undefined,
): EditCommand[] => (current === value ? [] : [{ op: "set", path, value }]);

const placementCommands = (raw: unknown, placement: Placement): EditCommand[] => {
  const path = pathOf(raw, placement);
  const item = recordOf(itemsOf(raw, LISTS[placement.kind])[path[2] as number]);
  if (placement.kind === "node") {
    const position = recordOf(item.position);
    const group = typeof item.group === "string" ? item.group : null;
    return [
      ...setIfChanged([...path, "position", "x"], position.x, placement.position.x),
      ...setIfChanged([...path, "position", "y"], position.y, placement.position.y),
      // No group: the key goes away, as the form does.
      ...(group === placement.group
        ? []
        : [{ op: "set" as const, path: [...path, "group"], value: placement.group ?? undefined }]),
    ];
  }
  const rect = recordOf(item.rect);
  const parent = typeof item.parent === "string" ? item.parent : null;
  return [
    ...(["x", "y", "w", "h"] as const).flatMap((key) =>
      setIfChanged([...path, "rect", key], rect[key], placement.rect[key]),
    ),
    // No parent: `null`, as the form writes it.
    ...(parent === placement.parent
      ? []
      : [{ op: "set" as const, path: [...path, "parent"], value: placement.parent }]),
  ];
};

/**
 * The edit commands of a command of the editor. `remove` is translated here too, but the app asks
 * before applying it (it is a request of the editor).
 */
export const translate = (raw: unknown, command: DiagramCommand): Translation => {
  switch (command.type) {
    case "place":
      return {
        commands: command.placements.flatMap((placement) => placementCommands(raw, placement)),
        isolate: command.input === "pointer",
      };
    case "addNode": {
      const value = newNode(raw, command.nodeType, command.position, command.group);
      return {
        commands: [{ op: "append", path: ["diagram", "nodes"], value }],
        isolate: true,
        select: { kind: "node", id: textOf(value.id) },
      };
    }
    case "addGroup": {
      const value = newGroup(raw, command.kind, command.rect, command.parent);
      return {
        commands: [{ op: "append", path: ["diagram", "groups"], value }],
        isolate: true,
        select: { kind: "group", id: textOf(value.id) },
      };
    }
    case "connect": {
      const value = newEdge(raw, command.from, command.to);
      return {
        commands: [{ op: "append", path: ["diagram", "edges"], value }],
        isolate: true,
        select: { kind: "edge", id: textOf(value.id) },
      };
    }
    case "remove": {
      const [, , index] = pathOf(raw, command.target) as [string, string, number];
      const commands =
        command.target.kind === "node"
          ? removeNodeCommands(raw, index)
          : command.target.kind === "group"
            ? removeGroupCommands(raw, index)
            : [{ op: "remove" as const, path: ["diagram", "edges", index] }];
      return { commands, isolate: true };
    }
    case "moveStep": {
      const [, , index] = pathOf(raw, { kind: "edge", id: command.edgeId }) as [
        string,
        string,
        number,
      ];
      const { commands, step } = stepCommands(raw, index, command.direction);
      return commands.length === 0 ? NOTHING : { commands, isolate: true, step };
    }
  }
};
