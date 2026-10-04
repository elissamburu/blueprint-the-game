// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Measures the board, the slots and the feedback card, and applies placeFeedback: the side of the
// card follows the board as it pans, zooms or resizes, and when the card opens (a placement, a
// resolved slot activated) the board may pan once so the card does not cover its slot. Panning
// never happens afterwards: the player moves the board freely.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { placeFeedback, type FeedbackSide, type Rect } from "./feedback-placement";

/** Distance of the card to an edge of the board, or to the controls floating at that edge (rem). */
const GAP_REM = 1;
/** Floating controls the card never covers: the board controls (zoom and player), bottom-left,
 * and the focus bar, at the top. */
const BOTTOM_CONTROLS = "[data-slot=board-controls]";
const TOP_CONTROLS = "[data-slot=focus-bar]";

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;

export interface FeedbackOffset {
  side: FeedbackSide;
  /** Distance in px from the card to that edge of the board. */
  gap: number;
}

export interface FeedbackPlacementOptions {
  /** The board area the card floats over. */
  area: RefObject<HTMLElement | null>;
  card: RefObject<HTMLElement | null>;
  slotId: string | null;
  /** Changes every time the card opens or its content changes (a new announcement). */
  openKey: number;
  /** Changes when the floating controls around the board change (e.g. focus mode). */
  layoutKey: string;
  panBoard: (dx: number, dy: number) => void;
}

export interface FeedbackPlacementState extends FeedbackOffset {
  /** Call on every change of the board viewport. */
  onViewportChange: () => void;
}

export const useFeedbackPlacement = ({
  area,
  card,
  slotId,
  openKey,
  layoutKey,
  panBoard,
}: FeedbackPlacementOptions): FeedbackPlacementState => {
  const [offset, setOffset] = useState<FeedbackOffset>({ side: "bottom", gap: 16 });
  const remeasure = useRef<() => void>(() => {});

  // Every time the card opens (or shows another result) it is measured again, and so is every
  // change of size of the card or the board (text, browser zoom, palette, focus mode). Only the
  // first measurement after opening may pan the board.
  useEffect(() => {
    const areaElement = area.current;
    const cardElement = card.current;
    if (areaElement === null || cardElement === null || slotId === null) return;
    let opening = true;
    // The card floats over its layer, which may leave a strip free on the left ("Ver caso"): the
    // geometry is relative to the layer, and slots under that strip count as out of view.
    const layer = cardElement.parentElement ?? areaElement;
    const measure = () => {
      const origin = layer.getBoundingClientRect();
      const relative = (element: Element): Rect => {
        const r = element.getBoundingClientRect();
        return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
      };
      const slots = [...areaElement.querySelectorAll<HTMLElement>("[data-slot-id]")];
      const target = slots.find((s) => s.dataset.slotId === slotId);
      const gap = GAP_REM * remPx();
      const bottomControls = areaElement.querySelector(BOTTOM_CONTROLS);
      const topControls = areaElement.querySelector(TOP_CONTROLS);
      const bottomGap =
        bottomControls === null ? gap : origin.height - relative(bottomControls).y + gap / 2;
      const topGap =
        topControls === null
          ? gap
          : relative(topControls).y + topControls.getBoundingClientRect().height + gap / 2;
      const placement = placeFeedback({
        board: { w: origin.width, h: origin.height },
        card: { w: cardElement.offsetWidth, h: cardElement.offsetHeight },
        bottomGap,
        topGap,
        target: target === undefined ? null : relative(target),
        others: slots.filter((s) => s !== target).map(relative),
      });
      const next = { side: placement.side, gap: placement.side === "bottom" ? bottomGap : topGap };
      setOffset((current) =>
        current.side === next.side && Math.abs(current.gap - next.gap) < 0.5 ? current : next,
      );
      if (opening && placement.panY !== 0) panBoard(0, placement.panY);
      opening = false;
    };
    remeasure.current = measure;
    // A ResizeObserver reports once as soon as it observes: that is the first measurement.
    const observer = new ResizeObserver(measure);
    observer.observe(areaElement);
    observer.observe(cardElement);
    // The player appears over the zoom; the focus bar comes and goes with focus mode.
    for (const selector of [BOTTOM_CONTROLS, TOP_CONTROLS]) {
      const element = areaElement.querySelector(selector);
      if (element !== null) observer.observe(element);
    }
    return () => {
      observer.disconnect();
      remeasure.current = () => {};
    };
  }, [area, card, slotId, openKey, layoutKey, panBoard]);

  // Pan and zoom arrive once per frame at most.
  const frame = useRef<number | null>(null);
  const onViewportChange = useCallback(() => {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      remeasure.current();
    });
  }, []);
  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return { ...offset, onViewportChange };
};
