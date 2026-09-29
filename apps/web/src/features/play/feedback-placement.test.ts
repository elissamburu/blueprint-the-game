// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  cardRect,
  overlaps,
  placeFeedback,
  PLACEMENT_MARGIN,
  type FeedbackLayout,
  type Rect,
} from "./feedback-placement";

/** A 1200 × 800 board with a 760 × 180 card, 68 px from the bottom and 16 px from the top. */
const layout = (target: Rect | null, others: Rect[] = []): FeedbackLayout => ({
  board: { w: 1200, h: 800 },
  card: { w: 760, h: 180 },
  bottomGap: 68,
  topGap: 16,
  target,
  others,
});

const slot = (x: number, y: number, size = 160): Rect => ({ x, y, w: size, h: size });

describe("placeFeedback", () => {
  it("goes at the bottom when it covers nothing", () => {
    expect(placeFeedback(layout(slot(100, 100)))).toEqual({ side: "bottom", panY: 0 });
  });

  it("goes at the top when the bottom card would cover its slot", () => {
    const target = slot(520, 520);
    expect(overlaps(cardRect(layout(target), "bottom"), target)).toBe(true);
    expect(placeFeedback(layout(target))).toEqual({ side: "top", panY: 0 });
  });

  it("never covers its slot, even when that means covering another one", () => {
    const target = slot(520, 520);
    const top = slot(520, 40);
    expect(placeFeedback(layout(target, [top]))).toEqual({ side: "top", panY: 0 });
  });

  it("of the sides that leave its slot visible, takes the one that covers fewer slots", () => {
    const target = slot(40, 300);
    const bottomOnes = [slot(300, 560), slot(600, 560)];
    const topOne = slot(500, 20);
    expect(placeFeedback(layout(target, [...bottomOnes, topOne]))).toEqual({
      side: "top",
      panY: 0,
    });
    expect(placeFeedback(layout(target, [topOne]))).toEqual({ side: "bottom", panY: 0 });
  });

  it("ignores slots out of view", () => {
    const target = slot(40, 300);
    const belowTheBoard = slot(500, 900);
    expect(placeFeedback(layout(target, [belowTheBoard, slot(500, 20)]))).toEqual({
      side: "bottom",
      panY: 0,
    });
  });

  it("pans the board when both sides would cover its slot (a large zoom)", () => {
    // At 300 % a slot is 480 px tall: it crosses both card positions of a 800 px board.
    const target = { x: 400, y: 150, w: 480, h: 480 };
    const placement = placeFeedback(layout(target));
    const card = cardRect(layout(target), placement.side);
    const moved = { ...target, y: target.y + placement.panY };
    expect(placement.panY).not.toBe(0);
    expect(overlaps(card, moved)).toBe(false);
    // Just enough: the slot ends up PLACEMENT_MARGIN away from the card.
    const gap =
      placement.side === "bottom" ? card.y - (moved.y + moved.h) : moved.y - (card.y + card.h);
    expect(gap).toBeCloseTo(PLACEMENT_MARGIN);
  });

  it("without its slot on the board, only avoids covering the others", () => {
    expect(placeFeedback(layout(null, [slot(520, 520)]))).toEqual({ side: "top", panY: 0 });
    expect(placeFeedback(layout(null))).toEqual({ side: "bottom", panY: 0 });
  });
});
