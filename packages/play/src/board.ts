// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Adapters between the game and the board (@blueprint/diagram): catalog → service lookup, and
// game-engine session → slot states. The grade and the number of each slot come from the engine;
// this only renames the grade. The icon URLs come from the app (GameHost.iconSrc); which name a
// card shows comes from catalog-entry.ts.
import type { ServiceLookup, SlotView } from "@blueprint/diagram";
import { slotNodes, slotNumbers, slotStatus, type SessionState } from "@blueprint/game-engine";
import { cardPlainName, entryIcon, type CardEntry } from "./catalog-entry";

/**
 * Name, category and icon of every catalog entry for the board. A concept gets its glyph and never
 * an icon URL. With `plainNames` (level 0) a revealed slot also shows the plain name.
 */
export const createServiceLookup = (
  services: readonly CardEntry[],
  iconSrc: (serviceId: string) => string | undefined,
  { plainNames = false }: { plainNames?: boolean } = {},
): ServiceLookup => {
  const byId = new Map(
    services.map((s) => {
      const { src, glyph } = entryIcon(s, iconSrc);
      const plainName = cardPlainName(s, plainNames);
      return [
        s.id,
        {
          name: s.name,
          category: s.category,
          iconSrc: src,
          ...(glyph === undefined ? {} : { glyph }),
          ...(plainName === undefined ? {} : { plainName }),
        },
      ];
    }),
  );
  return (id) => byId.get(id);
};

/**
 * Board state of every slot of the session. An accepted orange is still drawn orange; a revealed
 * slot is drawn as "Solución vista" (RF-PLAY-14), never as a green.
 */
export const slotViews = (session: SessionState): Record<string, SlotView> => {
  const hintTotals = new Map(slotNodes(session.scenario).map((n) => [n.id, n.hints.length]));
  const numbers = slotNumbers(session.scenario);
  return Object.fromEntries(
    session.slots.map((slot): [string, SlotView] => {
      const status = slotStatus(slot);
      return [
        slot.slotId,
        {
          grade: status === "accepted" ? "acceptable" : status,
          number: numbers.get(slot.slotId),
          serviceId: slot.placed,
          hints: { used: slot.hintsRevealed, total: hintTotals.get(slot.slotId) ?? 0 },
          selected: session.selectedSlotId === slot.slotId,
        },
      ];
    }),
  );
};
