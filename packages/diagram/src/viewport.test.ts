// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Diagram } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { nodeBox } from "./geometry";
import { pdfScenario, realScenarios } from "./testing/fixtures";
import {
  ANCHOR_MARGIN,
  anchorNode,
  contentBox,
  fitZoom,
  initialView,
  MIN_INITIAL_ZOOM,
  REVEAL_MARGIN,
  revealViewport,
  steppedZoom,
  type Size,
} from "./viewport";

const OPTIONS = { padding: 0.04, minZoom: 0.2, maxZoom: 2 };

/** Board sizes of the game screen at 1600 × 900 and 1366 × 768 (measured in Edge). */
const GAME_BOARDS: Size[] = [
  { width: 1090, height: 432 },
  { width: 856, height: 300 },
];

describe("fitZoom", () => {
  it("fits the bounds with padding and clamps to the zoom range", () => {
    expect(fitZoom({ w: 1000, h: 500 }, { width: 1040, height: 1000 }, 0.04, 0.2, 2)).toBe(1);
    expect(fitZoom({ w: 100, h: 100 }, { width: 1000, height: 1000 }, 0, 0.2, 2)).toBe(2);
    expect(fitZoom({ w: 10000, h: 100 }, { width: 100, height: 1000 }, 0, 0.2, 2)).toBe(0.2);
  });
});

describe("anchorNode", () => {
  it("is the source of the first step of the flow", () => {
    const first = [...pdfScenario.diagram.edges].sort((a, b) => a.step - b.step)[0];
    const source = pdfScenario.diagram.nodes.find((n) => n.id === first?.from);
    if (source === undefined) throw new Error("fixture without a first step");
    expect(anchorNode(pdfScenario.diagram)).toEqual(nodeBox(source));
  });

  it("falls back to the first actor, and to nothing", () => {
    const withoutEdges: Diagram = { ...pdfScenario.diagram, edges: [] };
    const actor = withoutEdges.nodes.find((n) => n.type === "actor");
    if (actor === undefined) throw new Error("fixture without actors");
    expect(anchorNode(withoutEdges)).toEqual(nodeBox(actor));
    expect(anchorNode({ nodes: [], edges: [] })).toBeNull();
  });
});

describe("contentBox", () => {
  it("spans every group and node, or the canvas when empty", () => {
    const box = contentBox(pdfScenario.diagram);
    for (const node of pdfScenario.diagram.nodes) {
      const b = nodeBox(node);
      expect(b.x).toBeGreaterThanOrEqual(box.x);
      expect(b.y).toBeGreaterThanOrEqual(box.y);
      expect(b.x + b.w).toBeLessThanOrEqual(box.x + box.w);
      expect(b.y + b.h).toBeLessThanOrEqual(box.y + box.h);
    }
    expect(contentBox({ canvas: { width: 10, height: 20 }, groups: [], nodes: [] })).toEqual({
      x: 0,
      y: 0,
      w: 10,
      h: 20,
    });
  });
});

describe("initialView", () => {
  it("fits when the fit zoom reaches the minimum opening zoom", () => {
    expect(initialView(pdfScenario.diagram, { width: 2000, height: 1200 }, OPTIONS)).toEqual({
      kind: "fit",
    });
  });

  it("opens at the minimum zoom with the top-left of the content in view", () => {
    const view = initialView(pdfScenario.diagram, { width: 1090, height: 900 }, OPTIONS);
    const content = contentBox(pdfScenario.diagram);
    expect(view).toEqual({
      kind: "anchored",
      viewport: {
        zoom: MIN_INITIAL_ZOOM,
        x: ANCHOR_MARGIN - content.x * MIN_INITIAL_ZOOM,
        y: ANCHOR_MARGIN - content.y * MIN_INITIAL_ZOOM,
      },
    });
  });

  it.each(realScenarios.flatMap((s) => GAME_BOARDS.map((size) => [s.id, s, size] as const)))(
    "%s on a %o board: never below 80 %% and the start of the flow in view",
    (_id, scenario, size) => {
      const view = initialView(scenario.diagram, size, OPTIONS);
      if (view.kind === "fit") {
        const canvas = { w: scenario.diagram.canvas.width, h: scenario.diagram.canvas.height };
        expect(fitZoom(canvas, size, 0.04, 0.2, 2)).toBeGreaterThanOrEqual(MIN_INITIAL_ZOOM);
        return;
      }
      const { x, y, zoom } = view.viewport;
      expect(zoom).toBe(MIN_INITIAL_ZOOM);
      const anchor = anchorNode(scenario.diagram);
      if (anchor === null) throw new Error("scenario without an anchor");
      expect(anchor.x * zoom + x).toBeGreaterThanOrEqual(0);
      expect(anchor.y * zoom + y).toBeGreaterThanOrEqual(0);
      expect((anchor.x + anchor.w) * zoom + x).toBeLessThanOrEqual(size.width);
      expect((anchor.y + anchor.h) * zoom + y).toBeLessThanOrEqual(size.height);
    },
  );
});

describe("steppedZoom", () => {
  it("goes to the next 25 % step and stops at the limits", () => {
    expect(steppedZoom(0.8, 1, 0.2, 3)).toBe(1);
    expect(steppedZoom(0.8, -1, 0.2, 3)).toBe(0.75);
    expect(steppedZoom(1, 1, 0.2, 3)).toBe(1.25);
    expect(steppedZoom(0.7499999, 1, 0.2, 3)).toBe(1);
    expect(steppedZoom(2.75, 1, 0.2, 3)).toBe(3);
    expect(steppedZoom(3, 1, 0.2, 3)).toBe(3);
    expect(steppedZoom(0.25, -1, 0.2, 3)).toBe(0.2);
  });

  it("reaches 300 % from the opening zoom in whole steps", () => {
    let zoom = 0.8;
    const seen: number[] = [];
    while (zoom < 3) {
      zoom = steppedZoom(zoom, 1, 0.2, 3);
      seen.push(zoom);
    }
    expect(seen).toEqual([1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3]);
  });
});

describe("revealViewport", () => {
  const BOARD = { width: 1200, height: 800 };
  const slot = { x: 960, y: 420, w: 160, h: 160 };

  it("does nothing for a slot already in view", () => {
    expect(revealViewport(slot, { x: -600, y: -300, zoom: 1 }, BOARD)).toBeNull();
  });

  it("centers a slot out of view without changing the zoom (300 %)", () => {
    const next = revealViewport(slot, { x: 0, y: 0, zoom: 3 }, BOARD);
    expect(next).toEqual({ x: 600 - 1040 * 3, y: 400 - 500 * 3, zoom: 3 });
  });

  it("shows whole a slot that a larger font made taller than its box", () => {
    // "Muy grande": at 300 % the slot is 663 px tall instead of 480.
    const next = revealViewport(slot, { x: 0, y: 0, zoom: 3 }, BOARD, { renderedHeight: 663 });
    if (next === null) throw new Error("no pan");
    const top = slot.y * 3 + next.y;
    expect(top).toBeGreaterThanOrEqual(REVEAL_MARGIN);
    expect(top + 663).toBeLessThanOrEqual(BOARD.height - REVEAL_MARGIN);
    // With the nominal box only, the grown slot would be cut at the bottom.
    const nominal = revealViewport(slot, { x: 0, y: 0, zoom: 3 }, BOARD);
    expect(slot.y * 3 + (nominal?.y ?? 0) + 663).toBeGreaterThan(BOARD.height);
  });

  it("shows the top of a slot taller than the board", () => {
    const next = revealViewport(slot, { x: 0, y: 0, zoom: 3 }, BOARD, { renderedHeight: 900 });
    expect((next?.y ?? 0) + slot.y * 3).toBe(REVEAL_MARGIN);
  });

  it("centers in the part of the board a left panel leaves free", () => {
    // A slot under a 400 px panel counts as out of view.
    const underPanel = { x: 100, y: 300, w: 160, h: 160 };
    const next = revealViewport(underPanel, { x: 0, y: 0, zoom: 1 }, BOARD, { insetLeft: 400 });
    expect((next?.x ?? 0) + underPanel.x + underPanel.w / 2).toBe(800);
    expect(revealViewport(underPanel, { x: 0, y: 0, zoom: 1 }, BOARD)).toBeNull();
  });
});
