// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { commands, type Command } from "@blueprint/game-engine";
import { describe, expect, it } from "vitest";
import {
  activateSlot,
  cancelSelection,
  chooseService,
  dropService,
  type InteractionState,
  type InteractionStep,
} from "./adapters";

const idle: InteractionState = { selectedSlotId: null, pendingServiceId: null };

/** Runs gestures, keeping the selection as the engine would after each selectSlot. */
const run = (...gestures: ((state: InteractionState) => InteractionStep)[]): Command[] => {
  let state = idle;
  const log: Command[] = [];
  for (const gesture of gestures) {
    const step = gesture(state);
    log.push(...step.commands);
    let selectedSlotId = state.selectedSlotId;
    for (const command of step.commands) {
      if (command.type === "selectSlot") selectedSlotId = command.slotId;
    }
    state = { selectedSlotId, pendingServiceId: step.pendingServiceId };
  }
  return log;
};

const placements = (log: readonly Command[]) => log.filter((c) => c.type === "placeService");

describe("interaction adapters (ADR-0008)", () => {
  const place = commands.placeService("upload-store", "s3");

  it("drag emits placeService", () => {
    expect(run(() => dropService("upload-store", "s3"))).toEqual([place]);
  });

  it("slot first emits selectSlot, placeService and releases the selection", () => {
    expect(
      run(
        (s) => activateSlot(s, "upload-store"),
        (s) => chooseService(s, "s3"),
      ),
    ).toEqual([commands.selectSlot("upload-store"), place, commands.selectSlot(null)]);
  });

  it("service first emits placeService once the slot is activated", () => {
    expect(
      run(
        (s) => chooseService(s, "s3"),
        (s) => activateSlot(s, "upload-store"),
      ),
    ).toEqual([place]);
  });

  it("the three adapters place the same service with the same command", () => {
    const drag = run(() => dropService("upload-store", "s3"));
    const slotFirst = run(
      (s) => activateSlot(s, "upload-store"),
      (s) => chooseService(s, "s3"),
    );
    const serviceFirst = run(
      (s) => chooseService(s, "s3"),
      (s) => activateSlot(s, "upload-store"),
    );
    expect(placements(drag)).toEqual([place]);
    expect(placements(slotFirst)).toEqual([place]);
    expect(placements(serviceFirst)).toEqual([place]);
  });

  it("choosing the pending service again drops it", () => {
    expect(chooseService({ ...idle, pendingServiceId: "s3" }, "s3")).toEqual({
      commands: [],
      pendingServiceId: null,
    });
    expect(chooseService({ ...idle, pendingServiceId: "s3" }, "efs").pendingServiceId).toBe("efs");
  });

  it("Esc releases the selected slot and the pending service", () => {
    expect(cancelSelection({ selectedSlotId: "upload-store", pendingServiceId: null })).toEqual({
      commands: [commands.selectSlot(null)],
      pendingServiceId: null,
    });
    expect(cancelSelection({ selectedSlotId: null, pendingServiceId: "s3" })).toEqual({
      commands: [],
      pendingServiceId: null,
    });
  });

  it("a drop discards the pending service", () => {
    expect(dropService("upload-store", "s3").pendingServiceId).toBeNull();
  });
});
