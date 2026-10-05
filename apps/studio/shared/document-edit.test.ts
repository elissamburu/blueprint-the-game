// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Edit commands over the Document (ADR-0025 §2): each one changes the data by its path and only
// the lines of the edited node, in the 8 scenarios of content/ (read, never written).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";
import {
  EditError,
  planEdit,
  planEdits,
  type EditCommand,
  type TextChange,
} from "./document-edit.js";

const SCENARIOS_DIR = path.join(import.meta.dirname, "..", "..", "..", "content", "scenarios");
const real: [string, string][] = readdirSync(SCENARIOS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
  .map((entry) => {
    const file = path.join(SCENARIOS_DIR, entry.name, "scenario.yaml");
    return [file, readFileSync(file, "utf8")];
  });

const apply = (text: string, change: TextChange | undefined): string =>
  change === undefined ? text : text.slice(0, change.from) + change.insert + text.slice(change.to);

const edit = (text: string, command: EditCommand): string => apply(text, planEdit(text, command));
const data = (text: string): unknown => parseDocument(text).toJS();

/** 1-based numbers of the lines of `before` that are not in `after` (common prefix and suffix). */
const changedLines = (before: string, after: string): { first: number; last: number } => {
  const a = before.split("\n");
  const b = after.split("\n");
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  ) {
    end++;
  }
  return { first: start + 1, last: a.length - end };
};

/** Lines (1-based, inclusive) that the value at `path` occupies, with its key. */
const linesOf = (text: string, path: (string | number)[]): { first: number; last: number } => {
  const document = parseDocument(text);
  const parent = document.getIn(path.slice(0, -1), true) as { items: unknown[] };
  const key = path[path.length - 1];
  const node = document.getIn(path, true) as { range: number[] };
  let start = node.range[0] ?? 0;
  if (typeof key === "string") {
    const pair = parent.items.find(
      (item) => (item as { key: { value: unknown } }).key.value === key,
    ) as { key: { range: number[] } };
    start = pair.key.range[0] ?? start;
  }
  const end = node.range[1] ?? start;
  const line = (offset: number) => text.slice(0, offset).split("\n").length;
  return { first: line(start), last: line(text.slice(0, end).trimEnd().length) };
};

/** Paths of the scalars of a scenario that the form edits, taken from its data. */
const scalarPaths = (text: string): (string | number)[][] => {
  const raw = data(text) as {
    objectives: unknown[];
    diagram: {
      nodes: { type: string; answers?: unknown[]; incorrect?: unknown[]; hints?: unknown[] }[];
    };
  };
  const slot = raw.diagram.nodes.findIndex((node) => node.type === "slot");
  const node = raw.diagram.nodes[slot];
  const paths: (string | number)[][] = [
    ["title"],
    ["summary"],
    ["context"],
    ["level"],
    ["estimatedMinutes"],
    ["objectives", raw.objectives.length - 1, "text"],
    ["objectives", 0, "kind"],
    ["diagram", "nodes", slot, "role"],
    ["diagram", "nodes", slot, "answers", 0, "rationale"],
    ["diagram", "nodes", slot, "answers", 0, "grade"],
    ["diagram", "nodes", slot, "position", "x"],
  ];
  if ((node?.incorrect?.length ?? 0) > 0) {
    paths.push(["diagram", "nodes", slot, "incorrect", 0, "rationale"]);
  }
  if ((node?.hints?.length ?? 0) > 0) paths.push(["diagram", "nodes", slot, "hints", 0]);
  return paths;
};

const newValue = (current: unknown): string | number =>
  typeof current === "number"
    ? current + 100
    : current === "hard"
      ? "soft"
      : current === "optimal"
        ? "acceptable"
        : `${String(current).trimEnd()} (editado desde el formulario, con "comillas" y: dos puntos)`;

describe("document edit", () => {
  it("covers the 8 scenarios of content/", () => {
    expect(real).toHaveLength(8);
  });

  describe.each(real)("%s", (_file, text) => {
    it.each(scalarPaths(text).map((path) => [path.join("."), path] as const))(
      "set %s changes only its lines and its data",
      (_name, path) => {
        const current = parseDocument(text).getIn(path);
        const value = newValue(current);
        const after = edit(text, { op: "set", path, value });

        const expected = parseDocument(text);
        expected.setIn(path, value);
        expect(data(after)).toEqual(expected.toJS());
        const changed = changedLines(text, after);
        const node = linesOf(text, path);
        expect(changed.first).toBeGreaterThanOrEqual(node.first);
        expect(changed.last).toBeLessThanOrEqual(node.last);
      },
    );

    it("keeps every comment when it edits a scalar", () => {
      const comments = (source: string) => source.split("\n").filter((line) => line.includes("#"));
      const after = edit(text, { op: "set", path: ["title"], value: "Otro título" });
      expect(comments(after)).toEqual(comments(text));
    });

    it("appends, moves and removes an objective, leaving the file as it was", () => {
      const count = (data(text) as { objectives: unknown[] }).objectives.length;
      const objective = { id: "nuevo-objetivo", kind: "soft", category: "cost", text: "Nuevo" };
      const added = edit(text, { op: "append", path: ["objectives"], value: objective });
      expect((data(added) as { objectives: unknown[] }).objectives).toEqual([
        ...(data(text) as { objectives: unknown[] }).objectives,
        objective,
      ]);
      expect(added).toContain('    text: "Nuevo"');

      const moved = edit(added, { op: "move", path: ["objectives", count], to: count - 1 });
      const ids = (source: string) =>
        (data(source) as { objectives: { id: string }[] }).objectives.map((item) => item.id);
      expect(ids(moved).at(-2)).toBe("nuevo-objetivo");
      const back = edit(moved, { op: "move", path: ["objectives", count - 1], to: count });
      expect(back).toBe(added);

      expect(edit(added, { op: "remove", path: ["objectives", count] })).toBe(text);
    });

    it("links and unlinks an objective of an answer (inline list)", () => {
      const raw = data(text) as {
        objectives: { id: string }[];
        diagram: { nodes: { type: string; answers?: { objectives: string[] }[] }[] };
      };
      const slot = raw.diagram.nodes.findIndex((node) => node.type === "slot");
      const linked = raw.diagram.nodes[slot]?.answers?.[0]?.objectives ?? [];
      const free = raw.objectives.find((objective) => !linked.includes(objective.id));
      if (free === undefined) return;
      const path = ["diagram", "nodes", slot, "answers", 0, "objectives"];
      const added = edit(text, { op: "append", path, value: free.id });
      expect(parseDocument(added).getIn(path)).toEqual(
        expect.objectContaining({ items: expect.anything() as unknown }),
      );
      expect(
        (parseDocument(added).toJS() as typeof raw).diagram.nodes[slot]?.answers?.[0]?.objectives,
      ).toEqual([...linked, free.id]);
      const changed = changedLines(text, added);
      expect(changed.last - changed.first).toBe(0);
      expect(edit(added, { op: "remove", path: [...path, linked.length] })).toBe(text);
    });
  });

  it("sets a value inside an inline map", () => {
    const text = "position: { x: 10, y: 20 } # esquina\n";
    expect(edit(text, { op: "set", path: ["position", "y"], value: 35 })).toBe(
      "position: { x: 10, y: 35 } # esquina\n",
    );
  });

  it("keeps the style of a folded scalar and the comments around it", () => {
    const text = "# arriba\nrationale: >\n  Una explicación\n  en dos líneas.\n# abajo\nnext: 1\n";
    const after = edit(text, { op: "set", path: ["rationale"], value: "Otra explicación.\n" });
    expect(after).toBe("# arriba\nrationale: >\n  Otra explicación.\n# abajo\nnext: 1\n");
  });

  it("adds a missing key at the end of its map, with the indentation of the map", () => {
    const text = 'edges:\n  - id: e1\n    label: "Sube"\n    style: sync\nother: 1\n';
    const after = edit(text, {
      op: "set",
      path: ["edges", 0, "description"],
      value: "Detalle",
    });
    expect(after).toBe(
      'edges:\n  - id: e1\n    label: "Sube"\n    style: sync\n    description: "Detalle"\nother: 1\n',
    );
    expect(edit(after, { op: "set", path: ["edges", 0, "description"], value: undefined })).toBe(
      text,
    );
  });

  it("creates a missing list and turns an empty one into a block list", () => {
    const text = 'slot:\n  role: "Rol"\n  incorrect: []\nend: true\n';
    const withHint = edit(text, { op: "append", path: ["slot", "hints"], value: "Pista" });
    expect(withHint).toBe(
      'slot:\n  role: "Rol"\n  incorrect: []\n  hints:\n    - "Pista"\nend: true\n',
    );
    const withIncorrect = edit(text, {
      op: "append",
      path: ["slot", "incorrect"],
      value: { service: "ec2", rationale: "No." },
    });
    expect(withIncorrect).toBe(
      'slot:\n  role: "Rol"\n  incorrect:\n    - service: ec2\n      rationale: "No."\nend: true\n',
    );
  });

  it("writes the geometry of a new node inline, as the scenarios do", () => {
    const text = "nodes:\n  - id: a\n    position: { x: 1, y: 2 }\n";
    expect(
      edit(text, {
        op: "append",
        path: ["nodes"],
        value: { id: "b", type: "actor", label: "Cliente", position: { x: 40, y: 80 } },
      }),
    ).toBe(
      `${text}  - id: b\n    type: actor\n    label: "Cliente"\n    position: { x: 40, y: 80 }\n`,
    );
  });

  it("removes the comments above a removed item, and keeps the separation of the list", () => {
    const text = "nodes:\n  - id: a\n\n  # el segundo\n  - id: b\n\n  - id: c\n";
    expect(edit(text, { op: "remove", path: ["nodes", 1] })).toBe(
      "nodes:\n  - id: a\n\n  - id: c\n",
    );
    expect(edit(text, { op: "remove", path: ["nodes", 0] })).toBe(
      "nodes:\n  # el segundo\n  - id: b\n\n  - id: c\n",
    );
    expect(edit(text, { op: "append", path: ["nodes"], value: { id: "d" } })).toBe(
      `${text}\n  - id: d\n`,
    );
  });

  it("removing the last item leaves an empty list", () => {
    expect(edit('hints:\n  - "Una"\nx: 1\n', { op: "remove", path: ["hints", 0] })).toBe(
      "hints: []\nx: 1\n",
    );
  });

  it("does nothing when the value does not change", () => {
    expect(planEdit("a: 1\n", { op: "set", path: ["a"], value: 1 })).toBeUndefined();
    expect(planEdit("a: 1\n", { op: "set", path: ["b"], value: undefined })).toBeUndefined();
  });

  it("returns the smallest change", () => {
    expect(
      planEdit('title: "Hola"\n', { op: "set", path: ["title"], value: "Hola mundo" }),
    ).toEqual({
      from: 12,
      to: 12,
      insert: " mundo",
    });
  });

  it("applies several commands in order, one change each", () => {
    const text = "edges:\n  - { id: a, step: 1 }\n  - { id: b, step: 2 }\n";
    const result = planEdits(text, [
      { op: "set", path: ["edges", 0, "step"], value: 2 },
      { op: "set", path: ["edges", 1, "step"], value: 1 },
    ]);
    expect(result.changes).toHaveLength(2);
    expect(result.text).toBe("edges:\n  - { id: a, step: 2 }\n  - { id: b, step: 1 }\n");
  });

  it("works with CRLF text read as LF and refuses a text that does not parse", () => {
    expect(() => planEdit("a: [\n", { op: "set", path: ["a"], value: 1 })).toThrow(EditError);
    expect(() => planEdit("a: 1\n", { op: "move", path: ["a", 0], to: 1 })).toThrow(EditError);
  });
});
