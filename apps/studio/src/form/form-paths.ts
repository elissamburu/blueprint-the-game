// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where each path of the document is in the form (RF-STU-07): the id of its field, derived from
// the path, and the sections that have to be open to see it. An issue of the validation panel
// whose path has no field of its own goes to the closest group that contains it (the answer, the
// list of answers, the node); a path the form does not edit (`palette`, `references`, the canvas)
// has no anchor and the panel takes the cursor to the YAML, as before. The fields of a slot that
// make it a slot (role, hints, answers) are in "Casilleros"; its id, place and group, as the ones
// of every node, in "Nodos".
import type { EditPath } from "./document-edit";

/** Id of the field (or group of fields) of a path: `form-diagram-nodes-3-answers-0-rationale`. */
export const fieldId = (path: EditPath): string => `form-${path.join("-")}`;
/** Id of the message of the issues of a field, for aria-describedby. */
export const errorId = (path: EditPath): string => `${fieldId(path)}-error`;

export type SectionKey =
  "metadata" | "context" | "objectives" | "slots" | `slot-${number}` | "groups" | "nodes" | "edges";

export interface Anchor {
  /** Path of the field or group that shows the issue. */
  path: EditPath;
  /** Sections to open, from the outermost. */
  sections: SectionKey[];
}

const METADATA = new Set([
  "id",
  "title",
  "summary",
  "level",
  "areas",
  "estimatedMinutes",
  "status",
  "version",
  "authors",
]);
const OBJECTIVE_FIELDS = new Set(["id", "kind", "category", "text"]);
const ANSWER_FIELDS = new Set(["service", "grade", "objectives", "rationale", "references"]);
const INCORRECT_FIELDS = new Set(["service", "violates", "rationale"]);
const SLOT_FIELDS = new Set(["role", "hints", "answers", "incorrect"]);
const GROUP_FIELDS = new Set(["id", "kind", "label", "parent"]);
const NODE_FIELDS = new Set(["id", "type", "label", "icon", "service", "group"]);
const EDGE_FIELDS = new Set(["id", "from", "to", "step", "label", "description", "style"]);
const BOX = new Set(["x", "y", "w", "h"]);

const isIndex = (key: unknown): key is number => typeof key === "number";

/** The node at `index` of the raw document is a slot. */
export type IsSlot = (index: number) => boolean;

/** The field of a slot in "Casilleros", or `undefined` for the fields of every node. */
const anchorOfSlot = (index: number, rest: EditPath): EditPath | undefined => {
  const slot: EditPath = ["diagram", "nodes", index];
  const [list, item, field, sub] = rest;
  if (typeof list !== "string" || !SLOT_FIELDS.has(list)) return undefined;
  if (list === "role" || !isIndex(item)) return [...slot, list];
  if (list === "hints") return [...slot, list, item];
  const fields = list === "answers" ? ANSWER_FIELDS : INCORRECT_FIELDS;
  if (typeof field !== "string" || !fields.has(field)) return [...slot, list, item];
  if (field === "references" && isIndex(sub)) return [...slot, list, item, field, sub];
  return [...slot, list, item, field];
};

/** The field or group of the form that shows `path`, or `undefined` if the form does not edit it. */
export const anchorOf = (path: EditPath, isSlot: IsSlot): Anchor | undefined => {
  const [first, second, third] = path;
  if (typeof first !== "string") return undefined;
  if (METADATA.has(first)) {
    const anchor: EditPath =
      first === "authors" && isIndex(second) ? ["authors", second, "github"] : [first];
    return { path: anchor, sections: ["metadata"] };
  }
  if (first === "context") return { path: ["context"], sections: ["context"] };
  if (first === "objectives") {
    const anchor: EditPath = !isIndex(second)
      ? ["objectives"]
      : typeof third === "string" && OBJECTIVE_FIELDS.has(third)
        ? ["objectives", second, third]
        : ["objectives", second];
    return { path: anchor, sections: ["objectives"] };
  }
  if (first !== "diagram") return undefined;
  if (second === "nodes" && isIndex(third) && isSlot(third)) {
    const slot = anchorOfSlot(third, path.slice(3));
    if (slot !== undefined) return { path: slot, sections: ["slots", `slot-${third}`] };
  }
  if (second === "groups") return diagramAnchor(path, "groups", GROUP_FIELDS, "rect");
  if (second === "nodes") return diagramAnchor(path, "nodes", NODE_FIELDS, "position");
  if (second === "edges") return diagramAnchor(path, "edges", EDGE_FIELDS);
  return undefined;
};

/** Groups, nodes and edges: the list, an item, a field, or a coordinate of its box. */
const diagramAnchor = (
  path: EditPath,
  list: "groups" | "nodes" | "edges",
  fields: ReadonlySet<string>,
  box?: string,
): Anchor => {
  const [, , index, field, coordinate] = path;
  const sections: SectionKey[] = [list];
  if (!isIndex(index)) return { path: ["diagram", list], sections };
  const item: EditPath = ["diagram", list, index];
  if (typeof field === "string" && fields.has(field)) return { path: [...item, field], sections };
  if (
    typeof field === "string" &&
    field === box &&
    typeof coordinate === "string" &&
    BOX.has(coordinate)
  ) {
    return { path: [...item, field, coordinate], sections };
  }
  return { path: item, sections };
};

export const pathKey = (path: EditPath): string => path.join("\u0000");
