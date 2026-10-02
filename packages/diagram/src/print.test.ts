// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  BOARD_LABEL_SIZE,
  MIN_PRINT_ZOOM,
  PRINT_AREA,
  PRINT_LABEL_MIN_PX,
  PRINT_LABEL_PX,
  PRINT_PADDING,
  printLayout,
} from "./print";
import { realScenarios } from "./testing/fixtures";

const slot = (id: string, x: number, y: number) => ({
  id,
  type: "slot" as const,
  position: { x, y },
  role: "Rol",
  answers: [],
  incorrect: [],
  hints: [],
});

/** A diagram whose content spans `w` × `h` canvas units. */
const diagramOf = (w: number, h: number) => ({
  canvas: { width: w + 80, height: h + 80 },
  groups: [],
  nodes: [slot("a", 40, 40), slot("b", 40 + w - 160, 40 + h - 160)],
});

describe("printLayout", () => {
  it("prints the real scenarios on a portrait sheet, inside its printable area", () => {
    for (const scenario of realScenarios) {
      const layout = printLayout(scenario.diagram);
      expect(layout.orientation, scenario.id).toBe("portrait");
      expect(layout.width).toBeLessThanOrEqual(PRINT_AREA.portrait.width);
      expect(layout.height).toBeLessThanOrEqual(PRINT_AREA.portrait.height);
      expect(layout.zoom).toBeGreaterThanOrEqual(MIN_PRINT_ZOOM);
    }
  });

  it("turns the sheet landscape when the diagram is too wide to read on a portrait one", () => {
    const layout = printLayout(diagramOf(1600, 800));
    expect(layout.orientation).toBe("landscape");
    expect(layout.width).toBeLessThanOrEqual(PRINT_AREA.landscape.width);
    expect(layout.height).toBeLessThanOrEqual(PRINT_AREA.landscape.height);
    expect(layout.zoom).toBeGreaterThan(PRINT_AREA.portrait.width / (1600 * (1 + PRINT_PADDING)));
  });

  it("keeps a tall diagram portrait: a landscape sheet would draw it smaller", () => {
    expect(printLayout(diagramOf(1600, 1600)).orientation).toBe("portrait");
  });

  it("sizes the names so they print at 6.5 pt at least, and lets them shrink only to 6 pt", () => {
    for (const scenario of realScenarios) {
      const { zoom, labelSize, minLabelSize } = printLayout(scenario.diagram);
      expect(labelSize).toBe(Math.max(BOARD_LABEL_SIZE, PRINT_LABEL_PX / zoom));
      expect(labelSize * zoom).toBeCloseTo(PRINT_LABEL_PX);
      expect(minLabelSize * zoom).toBeCloseTo(PRINT_LABEL_MIN_PX);
      expect(minLabelSize).toBeLessThan(labelSize);
    }
  });

  it("keeps the board size of the names when the zoom already prints them big enough", () => {
    const { zoom, labelSize } = printLayout(diagramOf(400, 300));
    expect(zoom).toBe(1);
    expect(labelSize).toBe(BOARD_LABEL_SIZE);
  });

  it("never draws a small diagram bigger than the canvas", () => {
    const layout = printLayout(diagramOf(400, 300));
    expect(layout.zoom).toBe(1);
    expect(layout.width).toBe(Math.floor(400 * (1 + PRINT_PADDING)));
  });
});
