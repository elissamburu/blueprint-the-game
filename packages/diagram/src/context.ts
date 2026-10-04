// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the custom nodes and edges need from the board besides their data. Callbacks travel by
// context so a new callback identity does not rebuild the React Flow nodes.
import { createContext, useContext, type ReactNode } from "react";
import type { Box } from "./geometry";
import type { SlotHintContext } from "./types";

export interface DiagramContextValue {
  onSlotActivate: ((slotId: string) => void) | undefined;
  slotHintAction: ((slotId: string, context: SlotHintContext) => ReactNode) | undefined;
  /** Slots are @dnd-kit drop targets (the board got onServiceDrop). */
  droppable: boolean;
  /**
   * Pans the board so the box (canvas units) is in view when a slot is reached with Tab. With the
   * rendered height (screen px) of a slot that grew past its box, the whole slot.
   */
  reveal: (box: Box, renderedHeight?: number) => void;
  /** Read-only preview (the brief): slots are drawn as empty boxes, without text. */
  preview: boolean;
  /** Still picture of the printable page: slots are empty boxes with their number. */
  print: boolean;
  /**
   * Printed: font size (canvas px) of the names of fixed nodes, actors and groups, and the size
   * a name may shrink to so it fits its box (printLayout). Null on screen.
   */
  printLabels: { size: number; min: number } | null;
  /**
   * Full motion: animated active edges and slot changes that move. False with
   * prefers-reduced-motion: no edge animation and slot changes only fade (RF-PLAY-17).
   */
  animate: boolean;
  /** The motion `key` of a slot has played (slot-motion.ts). */
  onSlotMotionEnd: (slotId: string, key: number) => void;
  /** Ids of the arrow markers (defs rendered once by the board). */
  markers: { idle: string; active: string };
}

export const DiagramContext = createContext<DiagramContextValue | null>(null);

export const useDiagramContext = (): DiagramContextValue => {
  const value = useContext(DiagramContext);
  if (value === null) throw new Error("Diagram nodes must be rendered inside <Diagram>");
  return value;
};
