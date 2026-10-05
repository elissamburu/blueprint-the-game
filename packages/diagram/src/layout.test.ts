// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The auto-layout (RF-STU-05) on every scenario of content/ and on broken drafts: nodes inside
// their groups and the groups inside their parents, no overlaps, on the grid, inside the canvas
// with its margin, the flow from left to right, and the same result every time. That the Studio
// writes only position, rect and canvas (and L007 passes) is tested in apps/studio.
import { NODE_SIZE, parseScenario, type Diagram } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import type { Box } from "./geometry";
import {
  autoLayout,
  GROUP_PADDING,
  LAYOUT_MARGIN,
  overlappingSiblingGroups,
  type LayoutInput,
  type LayoutResult,
} from "./layout";

const sources = import.meta.glob("../../../content/scenarios/*/scenario.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});

const diagrams: [string, Diagram][] = Object.entries(sources).map(([path, raw]) => {
  const parsed = parseScenario(parseYaml(raw));
  if (!parsed.success) throw new Error(`${path}: ${JSON.stringify(parsed.issues)}`);
  return [path.split("/").at(-2) ?? path, parsed.data.diagram];
});

const inside = (outer: Box, inner: Box) =>
  inner.x >= outer.x &&
  inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w &&
  inner.y + inner.h <= outer.y + outer.h;

const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const onGrid = (value: number) => value % 10 === 0;

/** Every geometric promise of the layout, for a diagram whose references are all valid. */
const expectSound = (diagram: LayoutInput, result: LayoutResult) => {
  const canvas = { x: 0, y: 0, w: result.canvas.width, h: result.canvas.height };
  const boxOf = (id: string, type: keyof typeof NODE_SIZE): Box => {
    const position = result.positions.get(id);
    if (position === undefined) throw new Error(`no position for ${id}`);
    return { ...position, ...NODE_SIZE[type] };
  };
  const rectOf = (id: string): Box => {
    const rect = result.rects.get(id);
    if (rect === undefined) throw new Error(`no rect for ${id}`);
    return rect;
  };
  const nodeBoxes = diagram.nodes.map((node) => boxOf(node.id, node.type));
  diagram.nodes.forEach((node, i) => {
    const box = nodeBoxes[i] as Box;
    expect([box.x, box.y].every(onGrid), node.id).toBe(true);
    expect(inside(canvas, box), node.id).toBe(true);
    if (node.group !== undefined) {
      const group = rectOf(node.group);
      expect(inside(group, box), `${node.id} in ${node.group}`).toBe(true);
      // Clear of the label chip.
      expect(box.y - group.y, node.id).toBeGreaterThanOrEqual(GROUP_PADDING.top - 5);
    } else {
      for (const group of diagram.groups) {
        expect(inside(rectOf(group.id), box), `${node.id} outside ${group.id}`).toBe(false);
      }
    }
    nodeBoxes.slice(0, i).forEach((other, j) => {
      expect(overlap(other, box), `${node.id} × ${diagram.nodes[j]?.id}`).toBe(false);
    });
  });
  diagram.groups.forEach((group, i) => {
    const rect = rectOf(group.id);
    expect([rect.x, rect.y, rect.w, rect.h].every(onGrid), group.id).toBe(true);
    expect(inside(canvas, rect), group.id).toBe(true);
    const parent = group.parent ?? null;
    if (parent !== null) expect(inside(rectOf(parent), rect), group.id).toBe(true);
    diagram.groups.slice(0, i).forEach((other) => {
      if ((other.parent ?? null) !== parent) return;
      expect(overlap(rectOf(other.id), rect), `${group.id} × ${other.id}`).toBe(false);
    });
  });
  // The margin: the content starts at it and the canvas ends at it.
  const all = [...nodeBoxes, ...diagram.groups.map((group) => rectOf(group.id))];
  expect(Math.min(...all.map((box) => box.x))).toBe(LAYOUT_MARGIN);
  expect(Math.min(...all.map((box) => box.y))).toBe(LAYOUT_MARGIN);
  expect(Math.max(...all.map((box) => box.x + box.w)) + LAYOUT_MARGIN).toBe(result.canvas.width);
  expect(Math.max(...all.map((box) => box.y + box.h)) + LAYOUT_MARGIN).toBe(result.canvas.height);
};

describe("autoLayout on every scenario of content/", () => {
  it("finds the scenarios", () => {
    expect(diagrams.length).toBeGreaterThanOrEqual(8);
  });

  it.each(diagrams)(
    "%s: inside, without overlaps, on the grid and with the margin",
    async (_, diagram) => {
      expectSound(diagram, await autoLayout(diagram));
    },
  );

  it.each(diagrams)(
    "%s: the same result every time, also over its own output",
    async (_, diagram) => {
      const first = await autoLayout(diagram);
      expect(await autoLayout(diagram)).toEqual(first);
      // Laying out what it laid out changes nothing ("Ya está ordenado").
      const again = await autoLayout({
        ...diagram,
        groups: diagram.groups.map((group) => ({
          ...group,
          rect: first.rects.get(group.id) as Box,
        })),
      });
      expect(again).toEqual(first);
    },
  );
});

describe("autoLayout", () => {
  const flow: LayoutInput = {
    groups: [{ id: "cloud", label: "Nube de AWS", rect: { x: 0, y: 0, w: 100, h: 100 } }],
    // Written in the reverse order of the flow.
    nodes: [
      { id: "store", type: "slot", group: "cloud" },
      { id: "api", type: "fixed", group: "cloud" },
      { id: "user", type: "actor" },
    ],
    edges: [
      { from: "api", to: "store", step: 2 },
      { from: "user", to: "api", step: 1 },
    ],
  };

  it("runs the flow from left to right", async () => {
    const result = await autoLayout(flow);
    expectSound(flow, result);
    const x = (id: string) => result.positions.get(id)?.x ?? NaN;
    expect(x("user")).toBeLessThan(x("api"));
    expect(x("api")).toBeLessThan(x("store"));
  });

  it("makes a group wide enough for its label", async () => {
    const label = "Una etiqueta de grupo bastante más larga que su contenido";
    const result = await autoLayout({
      groups: [{ id: "g", label, rect: { x: 0, y: 0, w: 50, h: 50 } }],
      nodes: [{ id: "a", type: "actor", group: "g" }],
      edges: [],
    });
    expect(result.rects.get("g")?.w).toBeGreaterThanOrEqual(label.length * 7 + 12 + 16);
  });

  it("keeps the size of an empty group", async () => {
    const result = await autoLayout({
      groups: [{ id: "empty", label: "Vacío", rect: { x: 500, y: 500, w: 300, h: 200 } }],
      nodes: [{ id: "a", type: "actor" }],
      edges: [],
    });
    expect(result.rects.get("empty")).toMatchObject({ w: 300, h: 200 });
  });

  it("nests groups and routes edges across them", async () => {
    const nested: LayoutInput = {
      groups: [
        { id: "region", label: "Región", rect: { x: 0, y: 0, w: 10, h: 10 }, parent: null },
        { id: "vpc", label: "VPC", rect: { x: 0, y: 0, w: 10, h: 10 }, parent: "region" },
        { id: "subnet", label: "Subred", rect: { x: 0, y: 0, w: 10, h: 10 }, parent: "vpc" },
      ],
      nodes: [
        { id: "user", type: "actor" },
        { id: "lb", type: "slot", group: "vpc" },
        { id: "app", type: "fixed", group: "subnet" },
        { id: "bucket", type: "fixed", group: "region" },
      ],
      edges: [
        { from: "user", to: "lb", step: 1 },
        { from: "lb", to: "app", step: 2 },
        { from: "app", to: "bucket", step: 3 },
      ],
    };
    expectSound(nested, await autoLayout(nested));
  });

  it("survives a broken draft: missing groups, cycles, loops, unknown ends and repeated ids", async () => {
    const result = await autoLayout({
      groups: [
        { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, parent: "b" },
        { id: "b", rect: { x: 0, y: 0, w: 100, h: 100 }, parent: "a" },
        { id: "c", rect: { x: 0, y: 0, w: 100, h: 100 }, parent: "missing" },
        { id: "c", rect: { x: 0, y: 0, w: 999, h: 999 } },
      ],
      nodes: [
        { id: "n1", type: "slot", group: "a" },
        { id: "n2", type: "actor", group: "nowhere" },
        { id: "n2", type: "slot" },
      ],
      edges: [
        { from: "n1", to: "n1", step: 1 },
        { from: "n1", to: "ghost", step: 2 },
        { from: "n2", to: "n1" },
      ],
    });
    expect([...result.positions.keys()].sort()).toEqual(["n1", "n2"]);
    expect([...result.rects.keys()].sort()).toEqual(["a", "b", "c"]);
  });

  it("lays out an empty diagram", async () => {
    const result = await autoLayout({ groups: [], nodes: [], edges: [] });
    expect(result).toEqual({
      positions: new Map(),
      rects: new Map(),
      canvas: { width: 2 * LAYOUT_MARGIN, height: 2 * LAYOUT_MARGIN },
    });
  });
});

describe("overlappingSiblingGroups", () => {
  it("names the sibling groups that overlap, not a child inside its parent", () => {
    const rect = (x: number, y: number) => ({ x, y, w: 100, h: 100 });
    expect(
      overlappingSiblingGroups({
        groups: [
          { id: "a", rect: rect(0, 0) },
          { id: "b", rect: rect(50, 50), parent: null },
          { id: "c", rect: rect(100, 0) },
          { id: "child", rect: rect(10, 10), parent: "a" },
          { id: "b", rect: rect(0, 0) },
        ],
      }),
    ).toEqual([
      { first: "a", second: "b" },
      { first: "b", second: "c" },
    ]);
  });
});
