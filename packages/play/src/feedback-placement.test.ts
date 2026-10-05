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
    // Top covers one slot and bottom two: top, and a pan uncovers that one (16 + 180 + 12 − 20).
    expect(placeFeedback(layout(target, [...bottomOnes, topOne]))).toEqual({
      side: "top",
      panY: 188,
    });
    expect(placeFeedback(layout(target, [topOne]))).toEqual({ side: "bottom", panY: 0 });
  });

  it("pans to uncover the other slots when that keeps its slot whole and uncovered", () => {
    // Its slot is down (so the card goes up); two others are partly under the top card.
    const target = slot(700, 520);
    const others = [slot(300, 150), slot(560, 150)];
    const placement = placeFeedback(layout(target, others));
    expect(placement.side).toBe("top");
    const card = cardRect(layout(target), "top");
    // Just below the card: 16 + 180 + 12 − 150.
    expect(placement.panY).toBe(card.y + card.h + PLACEMENT_MARGIN - 150);
    for (const other of others) {
      expect(overlaps(card, { ...other, y: other.y + placement.panY })).toBe(false);
    }
  });

  it("does not pan when uncovering the others would cut its own slot", () => {
    // Its slot sits at the very bottom: pushing the content down would take it out of view.
    const target = slot(700, 620);
    expect(placeFeedback(layout(target, [slot(300, 150)]))).toEqual({ side: "top", panY: 0 });
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
