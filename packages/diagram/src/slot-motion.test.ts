// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { endSlotMotion, initialSlotMotion, trackSlotMotion } from "./slot-motion";
import type { SlotView } from "./types";

const empty: SlotView = { grade: "empty", serviceId: null };
const view = (grade: SlotView["grade"], serviceId: string | null = "s3"): SlotView => ({
  grade,
  serviceId,
});

describe("slot motion", () => {
  it("moves nothing the board already shows when it is drawn", () => {
    const state = initialSlotMotion({ a: view("optimal"), b: empty });
    expect(state.motions).toEqual({});
    // Slots that come in after a board drawn without them were not seen change either.
    expect(trackSlotMotion(initialSlotMotion(undefined), { a: view("optimal") }).motions).toEqual(
      {},
    );
  });

  it("starts a motion on a placement and on a new grade, each with a new key", () => {
    let state = initialSlotMotion({ a: empty, b: empty });
    state = trackSlotMotion(state, { a: view("incorrect", "sqs"), b: empty });
    expect(state.motions).toEqual({ a: { key: 1, placed: true, graded: true } });
    // Another service over an incorrect one is a new result too, even with the same grade.
    state = trackSlotMotion(state, { a: view("incorrect", "sns"), b: empty });
    expect(state.motions.a).toEqual({ key: 2, placed: true, graded: true });
    // The solution of a slot: the grade changes with the service.
    state = trackSlotMotion(state, { a: view("incorrect", "sns"), b: view("revealed") });
    expect(state.motions.b).toEqual({ key: 3, placed: true, graded: true });
  });

  it("keeps a motion through changes that are not a placement nor a grade", () => {
    let state = initialSlotMotion({ a: empty });
    state = trackSlotMotion(state, { a: view("acceptable") });
    const { motions } = state;
    state = trackSlotMotion(state, { a: { ...view("acceptable"), selected: true } });
    state = trackSlotMotion(state, {
      a: { ...view("acceptable"), hints: { used: 1, total: 2 } },
    });
    expect(state.motions).toBe(motions);
  });

  it("drops the motion of a slot that becomes empty, and a played one", () => {
    let state = trackSlotMotion(initialSlotMotion({ a: empty, b: empty }), {
      a: view("incorrect"),
      b: view("optimal"),
    });
    state = trackSlotMotion(state, { a: empty, b: view("optimal") });
    expect(Object.keys(state.motions)).toEqual(["b"]);
    // An old key does not drop a newer motion.
    expect(endSlotMotion(state, "b", 1)).toBe(state);
    expect(endSlotMotion(state, "b", 2).motions).toEqual({});
  });

  it("does not replay a played motion when the same slots come in again", () => {
    const slots = { a: view("optimal") };
    let state = trackSlotMotion(initialSlotMotion({ a: empty }), slots);
    state = endSlotMotion(state, "a", 1);
    expect(trackSlotMotion(state, slots)).toBe(state);
    expect(trackSlotMotion(state, { a: view("optimal") }).motions).toEqual({});
  });
});
