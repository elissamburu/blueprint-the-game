// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pure geometry of the board in canvas units (docs/03 §2 "Geometría del diagrama"): node boxes,
// edges clipped to the node borders and the step circle of each edge placed on the free stretch
// of its edge (docs/design/README.md, problem 4).
import { NODE_SIZE, type DiagramNode, type Group } from "@blueprint/scenario-schema";

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Straight stretch of an edge between the borders of its two nodes. */
export interface Segment {
  start: Point;
  end: Point;
}

/** Radius of the step circle (20 px across at 100 % zoom). */
export const STEP_RADIUS = 10;
/** Free space kept between a step circle and anything else. */
export const STEP_CLEARANCE = 4;
/** Minimum target size of a control, in screen px (WCAG 2.5.8). */
export const MIN_TARGET = 24;
/** Length of the arrow head at the end of an edge: the circle never covers it. */
export const ARROW_LENGTH = 10;

/** Group label chip (GroupNode): offset from the top-left corner of the group and its size. */
export const GROUP_LABEL = { offsetX: 8, offsetY: 6, height: 18, charWidth: 7, padding: 12 };

/** Box of a node: `position` is its top-left corner, the size comes from NODE_SIZE. */
export const nodeBox = (node: Pick<DiagramNode, "type" | "position">): Box => ({
  ...node.position,
  ...NODE_SIZE[node.type],
});

export const center = (box: Box): Point => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

/** Font size (canvas px) of the label of a group on the board. */
export const GROUP_LABEL_FONT = 9.6;

/**
 * Box the label chip of a group covers. The width is an upper estimate of the uppercase label
 * (it is never measured, so the layout stays pure and the same in every browser). With
 * `fontSize` (the printed diagram, RF-PLAY-16) the chip has that font and wraps at the width of
 * the group, in two lines at most.
 */
export const groupLabelBox = (group: Pick<Group, "label" | "rect">, fontSize?: number): Box => {
  const x = group.rect.x + GROUP_LABEL.offsetX;
  const y = group.rect.y + GROUP_LABEL.offsetY;
  if (fontSize === undefined) {
    return {
      x,
      y,
      w: group.label.length * GROUP_LABEL.charWidth + GROUP_LABEL.padding,
      h: GROUP_LABEL.height,
    };
  }
  const scale = fontSize / GROUP_LABEL_FONT;
  const width = group.label.length * GROUP_LABEL.charWidth * scale + GROUP_LABEL.padding;
  const room = Math.max(1, group.rect.w - 2 * GROUP_LABEL.offsetX);
  const lines = Math.min(2, Math.ceil(width / room));
  return { x, y, w: Math.min(width, room), h: lines * fontSize * 1.15 + 4 };
};

/** Point where the ray from the center of `box` towards `toward` crosses the border of `box`. */
export const borderPoint = (box: Box, toward: Point): Point => {
  const c = center(box);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const tx = dx === 0 ? Infinity : box.w / 2 / Math.abs(dx);
  const ty = dy === 0 ? Infinity : box.h / 2 / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
};

const contains = (box: Box, p: Point): boolean =>
  p.x > box.x && p.x < box.x + box.w && p.y > box.y && p.y < box.y + box.h;

/**
 * Stretch of the line between the centers of both boxes that lies outside them: it starts on
 * the border of `source` and ends on the border of `target`, where the arrow tip goes. Null
 * when the boxes overlap so much that no stretch is left (L007 forbids overlapping nodes).
 */
export const edgeSegment = (source: Box, target: Box): Segment | null => {
  const start = borderPoint(source, center(target));
  const end = borderPoint(target, center(source));
  if (contains(target, start) || contains(source, end)) return null;
  const same = start.x === end.x && start.y === end.y;
  return same ? null : { start, end };
};

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The circle intersects the box (touching it within `clearance` counts). */
export const circleHitsBox = (p: Point, radius: number, box: Box, clearance = 0): boolean => {
  const nearestX = Math.max(box.x, Math.min(p.x, box.x + box.w));
  const nearestY = Math.max(box.y, Math.min(p.y, box.y + box.h));
  return distance(p, { x: nearestX, y: nearestY }) < radius + clearance;
};

export interface StepLabelRequest {
  id: string;
  segment: Segment;
}

export interface StepLabelPlacement {
  point: Point;
  /**
   * False when every position along the edge touches a node, a group label or another step
   * circle: the circle then goes to the least crowded position.
   */
  free: boolean;
}

/** Positions tried along an edge, as fractions of its length: middle first, then outwards. */
const CANDIDATES: readonly number[] = (() => {
  const out = [0.5];
  for (let d = 0.05; d < 0.5; d += 0.05) out.push(0.5 - d, 0.5 + d);
  return out.map((t) => Math.round(t * 100) / 100);
})();

/**
 * Places the step circle of each edge on its own edge, in request order. A position is free when
 * the circle (plus STEP_CLEARANCE) does not touch any obstacle (node boxes and group label boxes)
 * nor a circle placed before, and leaves room for the arrow head. The first free position from the
 * middle outwards wins; with none free, the one touching fewest obstacles, preferring to touch
 * other circles over nodes and group labels.
 */
export const placeStepLabels = (
  requests: readonly StepLabelRequest[],
  obstacles: readonly Box[],
): Map<string, StepLabelPlacement> => {
  const placed: Point[] = [];
  const result = new Map<string, StepLabelPlacement>();
  const minGap = STEP_RADIUS + STEP_CLEARANCE;

  for (const { id, segment } of requests) {
    const { start, end } = segment;
    const length = distance(start, end);
    const at = (t: number): Point => ({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });
    const fits = (t: number) => t * length >= minGap && (1 - t) * length >= minGap + ARROW_LENGTH;
    const candidates = CANDIDATES.filter(fits);

    let best: { point: Point; cost: number } | null = null;
    for (const t of candidates.length > 0 ? candidates : [0.5]) {
      const point = at(t);
      const hardHits = obstacles.filter((box) =>
        circleHitsBox(point, STEP_RADIUS, box, STEP_CLEARANCE),
      ).length;
      const softHits = placed.filter((other) => distance(point, other) < 2 * minGap).length;
      // Touching a node or a group label is worse than touching another circle.
      const cost = hardHits * 1000 + softHits;
      if (best === null || cost < best.cost) best = { point, cost };
      if (cost === 0) break;
    }
    const chosen = best ?? { point: at(0.5), cost: 1 };
    placed.push(chosen.point);
    result.set(id, { point: chosen.point, free: chosen.cost === 0 && candidates.length > 0 });
  }
  return result;
};

/**
 * Diameter (canvas units) of the press area of each step circle at a zoom: at least MIN_TARGET
 * screen px (WCAG 2.5.8) while the visible circle keeps its size, but never so large that it covers
 * the visible circle of another step (circles may sit close: `placeStepLabels` only avoids it).
 * Never smaller than the circle itself.
 */
export const stepTargetDiameters = (points: readonly Point[], zoom: number): number[] => {
  const wanted = Math.max(MIN_TARGET, MIN_TARGET / zoom);
  return points.map((point, i) => {
    const nearest = Math.min(
      Infinity,
      ...points.filter((_, j) => j !== i).map((other) => distance(point, other)),
    );
    return Math.max(2 * STEP_RADIUS, Math.min(wanted, 2 * (nearest - STEP_RADIUS)));
  });
};
