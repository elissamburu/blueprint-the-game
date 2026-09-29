// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Where the floating feedback card goes (docs/design, problem 24). The card floats at the bottom
// of the board, or at the top. It never covers the slot it talks about: it takes the side that
// leaves that slot visible and, of those, the one that covers fewer other slots. If that side
// still covers other slots and a vertical pan uncovers them all (keeping its slot whole and
// uncovered), the board pans. When neither side leaves the slot visible (a large zoom, a short
// board), the board pans just enough to move the slot out from under the card. Pure: every
// rectangle is relative to the board.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export type FeedbackSide = "bottom" | "top";

export interface FeedbackLayout {
  /** Size of the board (the area the card floats over). */
  readonly board: { readonly w: number; readonly h: number };
  /** Size of the card as rendered. */
  readonly card: { readonly w: number; readonly h: number };
  /** Distance from the card to the bottom edge, when at the bottom (room for the zoom controls). */
  readonly bottomGap: number;
  /** Distance from the card to the top edge, when at the top. */
  readonly topGap: number;
  /** The slot the feedback talks about, or null if it is not on the board. */
  readonly target: Rect | null;
  /** The other slots. */
  readonly others: readonly Rect[];
}

export interface FeedbackPlacement {
  readonly side: FeedbackSide;
  /** Vertical pan (screen px, positive moves the content down) to uncover the slot, if needed. */
  readonly panY: number;
}

/** Space kept between the card and the slot when the board pans. */
export const PLACEMENT_MARGIN = 12;

export const cardRect = (layout: FeedbackLayout, side: FeedbackSide): Rect => {
  const { board, card } = layout;
  return {
    x: (board.w - card.w) / 2,
    y: side === "bottom" ? board.h - layout.bottomGap - card.h : layout.topGap,
    w: card.w,
    h: card.h,
  };
};

export const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Part of a rectangle inside the board; null when it is entirely out of view. */
const visiblePart = (rect: Rect, board: FeedbackLayout["board"]): Rect | null => {
  const x = Math.max(rect.x, 0);
  const y = Math.max(rect.y, 0);
  const right = Math.min(rect.x + rect.w, board.w);
  const bottom = Math.min(rect.y + rect.h, board.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null;
};

const SIDES: readonly FeedbackSide[] = ["bottom", "top"];

export const placeFeedback = (layout: FeedbackLayout): FeedbackPlacement => {
  const covered = (side: FeedbackSide) => {
    const card = cardRect(layout, side);
    return layout.others.filter((other) => {
      const visible = visiblePart(other, layout.board);
      return visible !== null && overlaps(card, visible);
    }).length;
  };
  const target = layout.target === null ? null : visiblePart(layout.target, layout.board);
  const free = SIDES.filter((side) => target === null || !overlaps(cardRect(layout, side), target));
  if (free.length > 0) {
    // Fewer covered slots first; on a tie, the order of SIDES (bottom, as in the design).
    const side = [...free].sort((a, b) => covered(a) - covered(b))[0] ?? "bottom";
    return { side, panY: covered(side) === 0 ? 0 : uncoverOthers(layout, side) };
  }

  // Both sides cover the slot: pan it just above a bottom card or just below a top one, and
  // keep the side that needs the shorter pan.
  const slot = layout.target ?? { x: 0, y: 0, w: 0, h: 0 };
  const bottomCard = cardRect(layout, "bottom");
  const topCard = cardRect(layout, "top");
  const up = bottomCard.y - PLACEMENT_MARGIN - (slot.y + slot.h);
  const down = topCard.y + topCard.h + PLACEMENT_MARGIN - slot.y;
  return Math.abs(up) <= Math.abs(down)
    ? { side: "bottom", panY: up }
    : { side: "top", panY: down };
};

const shifted = (rect: Rect, dy: number): Rect => ({ ...rect, y: rect.y + dy });

/**
 * Vertical pan that moves every slot the card covers out from under it (down for a top card, up
 * for a bottom one), or 0 when that would cover or cut the slot the card talks about, or cover
 * another slot.
 */
const uncoverOthers = (layout: FeedbackLayout, side: FeedbackSide): number => {
  const card = cardRect(layout, side);
  const hidden = layout.others.filter((other) => {
    const visible = visiblePart(other, layout.board);
    return visible !== null && overlaps(card, visible);
  });
  const moves = hidden.map((other) =>
    side === "top"
      ? card.y + card.h + PLACEMENT_MARGIN - other.y
      : card.y - PLACEMENT_MARGIN - (other.y + other.h),
  );
  const dy = side === "top" ? Math.max(...moves) : Math.min(...moves);
  const target = layout.target === null ? null : shifted(layout.target, dy);
  const targetOk =
    target === null ||
    (target.y >= 0 && target.y + target.h <= layout.board.h && !overlaps(card, target));
  const othersOk = layout.others.every((other) => {
    const visible = visiblePart(shifted(other, dy), layout.board);
    return visible === null || !overlaps(card, visible);
  });
  return targetOk && othersOk ? dy : 0;
};
