// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Gesture → engine command adapters (ADR-0008). Pure: each gesture returns the commands to
// dispatch and the service picked in the palette while no slot is selected. Every rule stays
// in game-engine; this only translates gestures.
//
// - Drag: drop a palette service on a slot → placeService.
// - Slot first: activate a slot (Enter/click) → selectSlot; choose a service → placeService and
//   the selection is released (selectSlot(null)).
// - Service first: choose a service (it stays picked) → activate a slot → placeService.
import { commands, type Command } from "@blueprint/game-engine";

export interface InteractionState {
  /** Slot selected in the engine session (`selectedSlotId`). */
  readonly selectedSlotId: string | null;
  /** Service picked in the palette while no slot is selected (service first). */
  readonly pendingServiceId: string | null;
}

export interface InteractionStep {
  readonly commands: readonly Command[];
  readonly pendingServiceId: string | null;
}

/** Drag adapter: a service dropped on a slot. */
export const dropService = (slotId: string, serviceId: string): InteractionStep => ({
  commands: [commands.placeService(slotId, serviceId)],
  pendingServiceId: null,
});

/** A slot activated with Enter, Space or a click. */
export const activateSlot = (state: InteractionState, slotId: string): InteractionStep =>
  state.pendingServiceId !== null
    ? { commands: [commands.placeService(slotId, state.pendingServiceId)], pendingServiceId: null }
    : { commands: [commands.selectSlot(slotId)], pendingServiceId: null };

/**
 * A palette service chosen with Enter or a click. Without a selected slot it becomes the
 * pending service; choosing it again drops it.
 */
export const chooseService = (state: InteractionState, serviceId: string): InteractionStep =>
  state.selectedSlotId !== null
    ? {
        commands: [
          commands.placeService(state.selectedSlotId, serviceId),
          commands.selectSlot(null),
        ],
        pendingServiceId: null,
      }
    : {
        commands: [],
        pendingServiceId: state.pendingServiceId === serviceId ? null : serviceId,
      };

/** Esc: releases the selected slot and the pending service. */
export const cancelSelection = (state: InteractionState): InteractionStep => ({
  commands: state.selectedSlotId !== null ? [commands.selectSlot(null)] : [],
  pendingServiceId: null,
});
