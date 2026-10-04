// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// When a slot animates (RF-PLAY-17): only when its state CHANGES while the board is open, never
// because it is drawn. The board compares each new `slots` prop with the previous one, so it needs
// no game logic (ADR-0008: the state comes in by props). A slot the board first sees already
// resolved (an opened scenario, a board mounted again) does not move, and a motion is dropped
// once it has played, so React Flow mounting a node again (zoom, layout) does not replay it.
import type { SlotView } from "./types";

/** A change of a slot to play once; a new `key` plays it again. */
export interface SlotMotion {
  key: number;
  /** A service was placed. */
  placed: boolean;
  /** The slot has a new result (its grade changed, or a new service was evaluated). */
  graded: boolean;
}

type Slots = Readonly<Record<string, SlotView>> | undefined;

export interface SlotMotionState {
  /** The `slots` prop this state was computed from. */
  slots: Slots;
  /** Motions waiting to play or playing, by slot id. */
  motions: Readonly<Record<string, SlotMotion>>;
  /** Key of the next motion. */
  next: number;
}

const serviceOf = (view: SlotView | undefined) => view?.serviceId ?? null;
const gradeOf = (view: SlotView | undefined) => view?.grade ?? "empty";

/** The first state of a board: whatever is already there does not move. */
export const initialSlotMotion = (slots: Slots): SlotMotionState => ({
  slots,
  motions: {},
  next: 1,
});

/**
 * Motions after the slots changed. A placement or a new grade starts one; a slot that becomes
 * empty drops its own; any other change (hints, selection) keeps it playing.
 */
export const trackSlotMotion = (state: SlotMotionState, slots: Slots): SlotMotionState => {
  if (slots === state.slots) return state;
  // Slots that arrive after the board was drawn without them were not seen change.
  if (state.slots === undefined) return { ...state, slots };
  const motions: Record<string, SlotMotion> = { ...state.motions };
  let next = state.next;
  let changed = false;
  for (const [slotId, view] of Object.entries(slots ?? {})) {
    const before = state.slots?.[slotId];
    const service = serviceOf(view);
    const grade = gradeOf(view);
    const placed = service !== null && service !== serviceOf(before);
    const graded = grade !== "empty" && (placed || grade !== gradeOf(before));
    if (placed || graded) {
      motions[slotId] = { key: next, placed, graded };
      next += 1;
      changed = true;
    } else if (grade === "empty" && motions[slotId] !== undefined) {
      delete motions[slotId];
      changed = true;
    }
  }
  return { slots, motions: changed ? motions : state.motions, next };
};

/** The motion `key` of a slot has played: it is dropped (a newer one is kept). */
export const endSlotMotion = (
  state: SlotMotionState,
  slotId: string,
  key: number,
): SlotMotionState => {
  if (state.motions[slotId]?.key !== key) return state;
  const motions = { ...state.motions };
  delete motions[slotId];
  return { ...state, motions };
};

/**
 * Longest motion of a slot (360 ms) with margin: after it, the board drops the motions whose end
 * it did not hear (a node out of view, an animation the browser skipped).
 */
export const SLOT_MOTION_TTL_MS = 1_000;
