// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { NODE_SIZE } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import {
  ARROW_LENGTH,
  borderPoint,
  circleHitsBox,
  edgeSegment,
  groupLabelBox,
  MIN_TARGET,
  nodeBox,
  placeStepLabels,
  STEP_CLEARANCE,
  STEP_RADIUS,
  stepTargetDiameters,
  type Box,
  type Segment,
} from "./geometry";

const box = (x: number, y: number, w = 100, h = 100): Box => ({ x, y, w, h });

describe("nodeBox", () => {
  it("uses the position as the top-left corner and NODE_SIZE as the size", () => {
    expect(nodeBox({ type: "slot", position: { x: 10, y: 20 } })).toEqual({
      x: 10,
      y: 20,
      ...NODE_SIZE.slot,
    });
  });
});

describe("borderPoint", () => {
  it("leaves through the side the target is on", () => {
    expect(borderPoint(box(0, 0), { x: 500, y: 50 })).toEqual({ x: 100, y: 50 });
    expect(borderPoint(box(0, 0), { x: 50, y: -300 })).toEqual({ x: 50, y: 0 });
  });

  it("leaves through a corner on a diagonal", () => {
    expect(borderPoint(box(0, 0), { x: 150, y: 150 })).toEqual({ x: 100, y: 100 });
  });
});

describe("edgeSegment", () => {
  it("starts and ends on the node borders, so the arrow tip touches the target", () => {
    expect(edgeSegment(box(0, 0), box(300, 0))).toEqual({
      start: { x: 100, y: 50 },
      end: { x: 300, y: 50 },
    });
  });

  it("is null for overlapping nodes (no free stretch)", () => {
    expect(edgeSegment(box(0, 0), box(10, 10))).toBeNull();
  });
});

describe("groupLabelBox", () => {
  it("covers the label chip at the top-left corner, wider for longer labels", () => {
    const short = groupLabelBox({ label: "VPC", rect: { x: 100, y: 50, w: 400, h: 300 } });
    const long = groupLabelBox({
      label: "Subred privada A",
      rect: { x: 100, y: 50, w: 400, h: 300 },
    });
    expect(short).toMatchObject({ x: 108, y: 56, h: 18 });
    expect(long.w).toBeGreaterThan(short.w);
  });

  it("printed, grows with the font and wraps at the width of the group, in two lines at most", () => {
    const rect = { x: 100, y: 50, w: 200, h: 300 };
    const board = groupLabelBox({ label: "VPC", rect });
    const printed = groupLabelBox({ label: "VPC", rect }, 19.2);
    expect(printed).toMatchObject({ x: 108, y: 56 });
    expect(printed.w).toBeGreaterThan(board.w);
    expect(printed.h).toBeCloseTo(19.2 * 1.15 + 4);
    const long = groupLabelBox({ label: "Subredes privadas de los nodos", rect }, 19.2);
    expect(long.w).toBe(200 - 16);
    expect(long.h).toBeCloseTo(2 * 19.2 * 1.15 + 4);
  });
});

describe("placeStepLabels", () => {
  // Horizontal edge from x=100 to x=500 at y=50.
  const segment: Segment = { start: { x: 100, y: 50 }, end: { x: 500, y: 50 } };

  it("puts the circle in the middle of the edge when nothing is there", () => {
    const placed = placeStepLabels([{ id: "e1", segment }], []);
    expect(placed.get("e1")).toEqual({ point: { x: 300, y: 50 }, free: true });
  });

  it("moves along the edge when a node sits on the middle", () => {
    const node = box(270, 20, 60, 60);
    const { point, free } = placeStepLabels([{ id: "e1", segment }], [node]).get("e1")!;
    expect(free).toBe(true);
    expect(point.y).toBe(50); // still on the edge
    expect(circleHitsBox(point, STEP_RADIUS, node, STEP_CLEARANCE)).toBe(false);
  });

  it("moves when a group label sits on the middle", () => {
    const label = groupLabelBox({ label: "Nube", rect: { x: 285, y: 35, w: 400, h: 400 } });
    const { point } = placeStepLabels([{ id: "e1", segment }], [label]).get("e1")!;
    expect(circleHitsBox(point, STEP_RADIUS, label, STEP_CLEARANCE)).toBe(false);
  });

  it("does not stack the circles of two edges that cross in the middle", () => {
    const crossing: Segment = { start: { x: 300, y: -150 }, end: { x: 300, y: 250 } };
    const placed = placeStepLabels(
      [
        { id: "e1", segment },
        { id: "e2", segment: crossing },
      ],
      [],
    );
    const a = placed.get("e1")!.point;
    const b = placed.get("e2")!.point;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
      2 * (STEP_RADIUS + STEP_CLEARANCE),
    );
    expect(placed.get("e2")!.free).toBe(true);
  });

  it("keeps the circle off the arrow head", () => {
    const blocked = [box(110, 0, 380, 100)]; // covers the whole edge but its ends
    const { point, free } = placeStepLabels([{ id: "e1", segment }], blocked).get("e1")!;
    expect(free).toBe(false);
    expect(500 - point.x).toBeGreaterThanOrEqual(STEP_RADIUS + STEP_CLEARANCE + ARROW_LENGTH);
  });

  it("reports a crowded edge as not free and still places it on the edge", () => {
    const { point, free } = placeStepLabels([{ id: "e1", segment }], [box(0, 0, 600, 100)]).get(
      "e1",
    )!;
    expect(free).toBe(false);
    expect(point.y).toBe(50);
  });
});

describe("stepTargetDiameters", () => {
  const far = [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
  ];

  it("is 24 screen px at any zoom, without growing the visible circle", () => {
    expect(stepTargetDiameters(far, 1)).toEqual([MIN_TARGET, MIN_TARGET]);
    expect(stepTargetDiameters(far, 2)).toEqual([MIN_TARGET, MIN_TARGET]);
    // At 50 % the canvas area doubles so it is still 24 px on screen.
    expect(stepTargetDiameters(far, 0.5)).toEqual([2 * MIN_TARGET, 2 * MIN_TARGET]);
  });

  it("never covers the visible circle of a close step, nor shrinks below its own circle", () => {
    const close = [
      { x: 0, y: 0 },
      { x: 26, y: 0 },
      { x: 26, y: 0 },
    ];
    const [a, b, c] = stepTargetDiameters(close, 0.5);
    // a reaches 16 from its center: 26 − 16 = 10, the edge of the next circle.
    expect(a).toBe(2 * (26 - STEP_RADIUS));
    // Two circles on the same point keep just their own circle.
    expect(b).toBe(2 * STEP_RADIUS);
    expect(c).toBe(2 * STEP_RADIUS);
  });

  it("is the wanted size for a single step", () => {
    expect(stepTargetDiameters([{ x: 0, y: 0 }], 0.8)).toEqual([MIN_TARGET / 0.8]);
  });
});
