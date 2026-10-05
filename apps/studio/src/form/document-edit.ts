// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edit commands of the form over the YAML Document (ADR-0025 §2). Each command changes the
// Document by the finest path (setIn of a scalar, add, remove or move one item of a list), and the
// result is one splice of the text: the new node is serialized by `yaml` and only its own text
// replaces the old one, so the rest of the file (comments, blank lines, quotes, folding) stays as
// it was. `Document.toString()` alone would reformat the whole file.
//
// Every splice is checked: the new text has to parse to the same data as the edited Document. If
// it does not (an unusual layout this module does not foresee), the splice grows to the parent
// node, and so on up to the whole document, so an edit is never wrong, at worst wider.
import {
  isMap,
  isScalar,
  isSeq,
  parseDocument,
  Scalar,
  type Document,
  type Node,
  type Pair,
  type ToStringOptions,
  type YAMLMap,
  type YAMLSeq,
} from "yaml";

export type EditPath = readonly (string | number)[];
export type ScalarValue = string | number | boolean | null;

export type EditCommand =
  /** Sets a scalar; `undefined` removes the key. Missing keys (and their maps) are created. */
  | { op: "set"; path: EditPath; value: ScalarValue | undefined }
  /** Appends an item (a scalar or a plain object) to the list at `path`, creating it if missing. */
  | { op: "append"; path: EditPath; value: unknown }
  /** Removes the list item or the map key at `path`, with the comments above it. */
  | { op: "remove"; path: EditPath }
  /** Moves the list item at `path` one place, to the index `to` (the previous or the next one). */
  | { op: "move"; path: EditPath; to: number };

/** A splice of the text: replace `[from, to)` with `insert`. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

export class EditError extends Error {
  override name = "EditError";
}

/** Keys whose new string values are written in double quotes, as the scenarios do. */
const TEXT_KEYS = new Set([
  "title",
  "summary",
  "text",
  "role",
  "rationale",
  "label",
  "description",
  "hints",
]);
/** Keys whose lists of scalars are written inline (`[a, b]`), as the scenarios do. */
const FLOW_KEYS = new Set(["areas", "objectives", "violates", "extra"]);

const OPTIONS: ToStringOptions = { lineWidth: 0 };
/** Folded scalars (`>`) are folded again at a width close to the one of the scenarios. */
const FOLDED_OPTIONS: ToStringOptions = { lineWidth: 100, minContentWidth: 0 };

const parse = (text: string): Document.Parsed => {
  const document = parseDocument(text);
  if (document.errors.length > 0) {
    throw new EditError(`El YAML no se puede leer: ${document.errors[0]?.message ?? ""}`);
  }
  return document;
};

const nodeAt = (document: Document, path: EditPath): unknown =>
  path.length === 0 ? document.contents : document.getIn(path, true);

const keyOf = (pair: Pair): string =>
  isScalar(pair.key) ? String(pair.key.value) : String(pair.key);

const pairOf = (map: YAMLMap, key: string | number): Pair<Node, Node | null> | undefined =>
  map.items.find((pair) => keyOf(pair) === String(key)) as Pair<Node, Node | null> | undefined;

const rangeOf = (node: unknown): readonly [number, number, number] => {
  const range = (node as { range?: [number, number, number] | null } | null)?.range;
  if (range === undefined || range === null) throw new EditError("Nodo sin posición");
  return range;
};

// --- Text helpers -------------------------------------------------------------------------------

const lineStart = (text: string, pos: number): number => text.lastIndexOf("\n", pos - 1) + 1;
const lineEnd = (text: string, pos: number): number => {
  const end = text.indexOf("\n", pos);
  return end === -1 ? text.length : end;
};
const column = (text: string, pos: number): number => pos - lineStart(text, pos);
const isBlank = (line: string): boolean => line.trim() === "";

/** `end` moved back over trailing whitespace and line breaks, but not before `start`. */
const trimEnd = (text: string, start: number, end: number): number => {
  let at = end;
  while (at > start && /\s/.test(text[at - 1] ?? "")) at--;
  return at;
};

/** Shifts every line but the first by `delta` columns (blank lines stay empty). */
const reindent = (text: string, delta: number): string => {
  if (delta === 0) return text;
  return text
    .split("\n")
    .map((line, index) => {
      if (index === 0 || isBlank(line)) return index === 0 ? line : "";
      if (delta > 0) return " ".repeat(delta) + line;
      const spaces = line.length - line.trimStart().length;
      return line.slice(Math.min(spaces, -delta));
    })
    .join("\n");
};

/**
 * Lines of an item of a block list or of a pair of a block map: from the first comment line right
 * above it (its comments go with it) to the end of its last line, without the line break.
 */
const blockOf = (text: string, start: number, end: number): { start: number; end: number } => {
  let first = lineStart(text, start);
  const indent = column(text, start);
  while (first > 0) {
    const previous = lineStart(text, first - 1);
    const line = text.slice(previous, first - 1);
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("#") || line.length - trimmed.length < indent - 2) break;
    first = previous;
  }
  return { start: first, end: lineEnd(text, trimEnd(text, start, end)) };
};

const itemBlock = (text: string, collection: YAMLSeq | YAMLMap, index: number) => {
  const item = collection.items[index];
  if (isMap(collection)) {
    const pair = item as Pair;
    const end = pair.value === null ? rangeOf(pair.key)[1] : rangeOf(pair.value)[1];
    // The "- " of a list item is before the start of the key: the block starts at the key.
    return blockOf(text, rangeOf(pair.key)[0], end);
  }
  const [start, end] = rangeOf(item);
  return blockOf(text, start, end);
};

// --- Building new nodes -------------------------------------------------------------------------

/** A new node with the style of the scenarios: text in double quotes, lists of ids inline. */
const createNode = (document: Document, value: unknown, key?: string | number): Node => {
  const node = document.createNode(value) as Node;
  const style = (current: unknown, parentKey: string | number | undefined) => {
    if (isScalar(current)) {
      if (typeof current.value === "string" && TEXT_KEYS.has(String(parentKey))) {
        current.type = Scalar.QUOTE_DOUBLE;
      }
    } else if (isSeq(current)) {
      current.flow =
        FLOW_KEYS.has(String(parentKey)) && current.items.every((item) => isScalar(item));
      for (const item of current.items) style(item, parentKey);
    } else if (isMap(current)) {
      current.flow = false;
      for (const pair of current.items) style(pair.value, keyOf(pair));
    }
  };
  style(node, key);
  return node;
};

// --- Splices ------------------------------------------------------------------------------------

/**
 * The text of the value at `path` and where it is: for a map entry, from the end of its key (so
 * `key: []` can become `key:\n  - …`); for a list item or the root, the node itself.
 */
const valueSpan = (text: string, document: Document, path: EditPath) => {
  if (path.length === 0) {
    const [start, end] = rangeOf(document.contents);
    return { from: start, to: trimEnd(text, start, end), column: 0 };
  }
  const parent = nodeAt(document, path.slice(0, -1));
  const key = path[path.length - 1] ?? "";
  if (isMap(parent)) {
    const pair = pairOf(parent, key);
    if (pair === undefined) throw new EditError(`No existe ${path.join(".")}`);
    const [keyStart, keyEnd] = rangeOf(pair.key);
    const end =
      pair.value !== null && pair.value.range !== undefined && pair.value.range !== null
        ? rangeOf(pair.value)[1]
        : text.indexOf(":", keyEnd) + 1;
    return { from: keyEnd, to: trimEnd(text, keyEnd, end), column: column(text, keyStart) };
  }
  if (isSeq(parent) && typeof key === "number") {
    const [start, end] = rangeOf(parent.items[key]);
    return { from: start, to: trimEnd(text, start, end), column: column(text, start) };
  }
  throw new EditError(`No existe ${path.join(".")}`);
};

const serialize = (document: Document, options: ToStringOptions) => {
  const text = document.toString(options);
  return { text, document: parse(text) };
};

/** Inline collections keep their padding: `[a, b]` or `{ x: 1 }`, as the original node has it. */
const paddingOf = (text: string, node: unknown): ToStringOptions => {
  if (!(isSeq(node) || isMap(node)) || node.flow !== true) return {};
  const [start] = rangeOf(node);
  return { flowCollectionPadding: text[start + 1] === " " };
};

/** Replaces the value at `path` with its serialization in the edited Document. */
const replaceValue = (
  text: string,
  original: Document,
  edited: Document,
  path: EditPath,
  options: ToStringOptions = OPTIONS,
): TextChange => {
  const target = valueSpan(text, original, path);
  const output = serialize(edited, { ...options, ...paddingOf(text, nodeAt(original, path)) });
  const source = valueSpan(output.text, output.document, path);
  return {
    from: target.from,
    to: target.to,
    insert: reindent(output.text.slice(source.from, source.to), target.column - source.column),
  };
};

const isBlock = (node: unknown): node is YAMLSeq | YAMLMap =>
  (isSeq(node) || isMap(node)) && node.flow !== true && node.items.length > 0;

const remove = (text: string, original: Document, edited: Document, path: EditPath) => {
  const parentPath = path.slice(0, -1);
  const key = path[path.length - 1] ?? "";
  const parent = nodeAt(original, parentPath);
  const index = isMap(parent)
    ? parent.items.findIndex((pair) => keyOf(pair) === String(key))
    : Number(key);
  if (!(isMap(parent) || isSeq(parent)) || index < 0 || index >= parent.items.length) {
    throw new EditError(`No existe ${path.join(".")}`);
  }
  (nodeAt(edited, parentPath) as YAMLMap | YAMLSeq).delete(isMap(parent) ? key : index);

  if (!isBlock(parent) || parent.items.length < 2) {
    return replaceValue(text, original, edited, parentPath);
  }
  const block = itemBlock(text, parent, index);
  // With the line break and the blank lines that separate it from its neighbor.
  if (index > 0) return { from: itemBlock(text, parent, index - 1).end, to: block.end, insert: "" };
  return { from: block.start, to: itemBlock(text, parent, 1).start, insert: "" };
};

const move = (text: string, original: Document, edited: Document, path: EditPath, to: number) => {
  const parentPath = path.slice(0, -1);
  const from = Number(path[path.length - 1]);
  const parent = nodeAt(original, parentPath);
  if (!isSeq(parent) || Math.abs(from - to) !== 1 || to < 0 || to >= parent.items.length) {
    throw new EditError(`No se puede mover ${path.join(".")} a ${to}`);
  }
  const items = (nodeAt(edited, parentPath) as YAMLSeq).items;
  const [item] = items.splice(from, 1);
  items.splice(to, 0, item);

  if (!isBlock(parent)) return replaceValue(text, original, edited, parentPath);
  const first = itemBlock(text, parent, Math.min(from, to));
  const second = itemBlock(text, parent, Math.max(from, to));
  return {
    from: first.start,
    to: second.end,
    insert:
      text.slice(second.start, second.end) +
      text.slice(first.end, second.start) +
      text.slice(first.start, first.end),
  };
};

/** Inserts the missing key `path[at]` of the map at `path.slice(0, at)`, already set in `edited`. */
const insertPair = (
  text: string,
  original: Document,
  edited: Document,
  path: EditPath,
  at: number,
): TextChange => {
  const mapPath = path.slice(0, at);
  const map = nodeAt(original, mapPath);
  if (!isBlock(map) || !isMap(map)) return replaceValue(text, original, edited, mapPath);
  const output = serialize(edited, OPTIONS);
  const newMap = nodeAt(output.document, mapPath) as YAMLMap;
  const pair = pairOf(newMap, path[at] ?? "");
  if (pair === undefined) throw new EditError(`No se creó ${path.join(".")}`);
  const [keyStart] = rangeOf(pair.key);
  const end = pair.value === null ? rangeOf(pair.key)[1] : rangeOf(pair.value)[1];
  const lines = output.text.slice(
    keyStart,
    lineEnd(output.text, trimEnd(output.text, keyStart, end)),
  );
  const firstKey = rangeOf((map.items[0] as Pair).key)[0];
  const indent = column(text, firstKey);
  const last = itemBlock(text, map, map.items.length - 1);
  return {
    from: last.end,
    to: last.end,
    insert: `\n${" ".repeat(indent)}${reindent(lines, indent - column(output.text, keyStart))}`,
  };
};

/** The index of the first key of `path` that the document does not have, or -1. */
const firstMissing = (document: Document, path: EditPath): number => {
  for (let at = 0; at < path.length; at++) {
    if (nodeAt(document, path.slice(0, at + 1)) === undefined) {
      const parent = nodeAt(document, path.slice(0, at));
      if (!isMap(parent) && parent !== undefined && parent !== null) {
        throw new EditError(`No se puede crear ${path.join(".")}`);
      }
      return at;
    }
  }
  return -1;
};

const append = (
  text: string,
  original: Document,
  edited: Document,
  path: EditPath,
  value: unknown,
) => {
  const key = path[path.length - 1];
  const list = nodeAt(original, path);
  if (list === undefined || list === null) {
    const missing = firstMissing(original, path);
    edited.setIn(path, createNode(edited, [value], key));
    return insertPair(text, original, edited, path, missing === -1 ? path.length - 1 : missing);
  }
  if (!isSeq(list)) throw new EditError(`${path.join(".")} no es una lista`);
  const editedList = nodeAt(edited, path) as YAMLSeq;
  const node = createNode(edited, value, key);
  editedList.add(node);
  if (isMap(node) || isSeq(node)) editedList.flow = false;

  if (!isBlock(list)) return replaceValue(text, original, edited, path);
  const output = serialize(edited, OPTIONS);
  const newList = nodeAt(output.document, path) as YAMLSeq;
  const added = itemBlock(output.text, newList, newList.items.length - 1);
  const dash =
    added.start +
    (output.text.slice(added.start).length - output.text.slice(added.start).trimStart().length);
  const count = list.items.length;
  const last = itemBlock(text, list, count - 1);
  const lastDash = lineStart(text, rangeOf(list.items[count - 1])[0]);
  const indent = text.slice(lastDash).length - text.slice(lastDash).trimStart().length;
  // The same separation as the last two items (a blank line between the nodes, for example).
  const gap = count >= 2 ? text.slice(itemBlock(text, list, count - 2).end, last.start) : "\n";
  return {
    from: last.end,
    to: last.end,
    insert:
      (isBlank(gap) && gap.includes("\n") ? gap.slice(0, gap.lastIndexOf("\n") + 1) : "\n") +
      " ".repeat(indent) +
      reindent(output.text.slice(dash, added.end), indent - column(output.text, dash)),
  };
};

const set = (
  text: string,
  original: Document,
  edited: Document,
  path: EditPath,
  value: ScalarValue | undefined,
): TextChange | undefined => {
  const current = nodeAt(original, path);
  if (value === undefined) {
    return current === undefined ? undefined : remove(text, original, edited, path);
  }
  if (current === undefined) {
    const missing = firstMissing(original, path);
    edited.setIn(path, createNode(edited, value, path[path.length - 1]));
    return insertPair(text, original, edited, path, missing);
  }
  if (isScalar(current) && current.value === value) return undefined;
  edited.setIn(path, value);
  const folded = isScalar(current) && current.type === Scalar.BLOCK_FOLDED;
  return replaceValue(text, original, edited, path, folded ? FOLDED_OPTIONS : OPTIONS);
};

const sameData = (text: string, expected: Document): boolean => {
  const result = parseDocument(text);
  return (
    result.errors.length === 0 && JSON.stringify(result.toJS()) === JSON.stringify(expected.toJS())
  );
};

/** The change without the text it keeps at both ends (the smallest transaction). */
const shrink = (text: string, change: TextChange): TextChange => {
  const removed = text.slice(change.from, change.to);
  let start = 0;
  const max = Math.min(removed.length, change.insert.length);
  while (start < max && removed[start] === change.insert[start]) start++;
  let end = 0;
  while (
    end < max - start &&
    removed[removed.length - 1 - end] === change.insert[change.insert.length - 1 - end]
  ) {
    end++;
  }
  return {
    from: change.from + start,
    to: change.to - end,
    insert: change.insert.slice(start, change.insert.length - end),
  };
};

const applyChange = (text: string, change: TextChange): string =>
  text.slice(0, change.from) + change.insert + text.slice(change.to);

const plan = (text: string, command: EditCommand, original: Document, edited: Document) => {
  switch (command.op) {
    case "set":
      return set(text, original, edited, command.path, command.value);
    case "append":
      return append(text, original, edited, command.path, command.value);
    case "remove":
      return remove(text, original, edited, command.path);
    case "move":
      return move(text, original, edited, command.path, command.to);
  }
};

/**
 * The change of the text for one command, or `undefined` when the command changes nothing.
 * Throws EditError when the text does not parse or the path does not fit the document.
 */
export const planEdit = (text: string, command: EditCommand): TextChange | undefined => {
  const original = parse(text);
  const edited = parse(text);
  const change = plan(text, command, original, edited);
  if (change === undefined) return undefined;
  if (sameData(applyChange(text, change), edited)) return shrink(text, change);
  // Safety net: a wider splice, from the parent of the edited node up to the whole document.
  const path = command.path;
  for (let length = path.length - 1; length >= 0; length--) {
    const parentPath = path.slice(0, length);
    if (nodeAt(edited, parentPath) === undefined) continue;
    try {
      const wider = replaceValue(text, original, edited, parentPath);
      if (sameData(applyChange(text, wider), edited)) return shrink(text, wider);
    } catch {
      // The parent did not exist in the original: try the next one up.
    }
  }
  return { from: 0, to: text.length, insert: edited.toString(OPTIONS) };
};

/** Applies the commands one after the other: one change per command, each over the previous text. */
export const planEdits = (
  text: string,
  commands: readonly EditCommand[],
): { changes: TextChange[]; text: string } => {
  const changes: TextChange[] = [];
  let current = text;
  for (const command of commands) {
    const change = planEdit(current, command);
    if (change === undefined) continue;
    changes.push(change);
    current = applyChange(current, change);
  }
  return { changes, text: current };
};
