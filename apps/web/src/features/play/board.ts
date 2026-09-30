// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Adapters between the game and the board (@blueprint/diagram): catalog → service lookup, and
// game-engine session → slot states. The grade comes from the engine; this only renames it.
import type { ServiceLookup, SlotView } from "@blueprint/diagram";
import { slotNodes, slotStatus, type SessionState } from "@blueprint/game-engine";
import type { Service } from "@blueprint/scenario-schema";
import { serviceIconSrc } from "../../service-icons";

export const createServiceLookup = (
  services: readonly Pick<Service, "id" | "name" | "category">[],
): ServiceLookup => {
  const byId = new Map(
    services.map((s) => [
      s.id,
      { name: s.name, category: s.category, iconSrc: serviceIconSrc(s.id) },
    ]),
  );
  return (id) => byId.get(id);
};

/**
 * Board state of every slot of the session. An accepted orange is still drawn orange; a revealed
 * slot is drawn as "Solución vista" (RF-PLAY-14), never as a green.
 */
export const slotViews = (session: SessionState): Record<string, SlotView> => {
  const hintTotals = new Map(slotNodes(session.scenario).map((n) => [n.id, n.hints.length]));
  return Object.fromEntries(
    session.slots.map((slot): [string, SlotView] => {
      const status = slotStatus(slot);
      return [
        slot.slotId,
        {
          grade: status === "accepted" ? "acceptable" : status,
          serviceId: slot.placed,
          hints: { used: slot.hintsRevealed, total: hintTotals.get(slot.slotId) ?? 0 },
          selected: session.selectedSlotId === slot.slotId,
        },
      ];
    }),
  );
};
