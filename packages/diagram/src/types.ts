// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public contract of the board. The board draws what it is told: the app computes each slot
// state with game-engine and passes it here; the board only emits events.
import type { ConceptGlyph } from "@blueprint/scenario-schema";
import type { SlotGrade } from "@blueprint/ui/components/grade-badge";

export type { SlotGrade };

/** State of a slot as the board shows it. A slot without state is drawn empty. */
export interface SlotView {
  grade: SlotGrade;
  /**
   * Number of the slot in the scenario (game-engine `slotNumbers`): its accessible name ends with
   * it and its role becomes its description. Without it the slot is named after its role.
   */
  number?: number | undefined;
  /** Catalog id of the placed service, or null/undefined when nothing is placed. */
  serviceId?: string | null | undefined;
  /** Hints revealed and available (RF-PLAY-06). Without it: none used, total from the scenario. */
  hints?: { used: number; total: number } | undefined;
  /** The slot is the target of the keyboard/tap flow (selectSlot). */
  selected?: boolean | undefined;
}

/** What the board needs to draw a catalog service. */
export interface ServiceInfo {
  name: string;
  /** Catalog category id: color of the icon fallback. */
  category: string;
  /** Icon URL; without it, the initials over the category color. */
  iconSrc?: string | undefined;
  /** Glyph of a concept (ADR-0027 §1), drawn instead of an icon. */
  glyph?: ConceptGlyph | undefined;
  /**
   * Plain name a revealed slot shows on top of the name (level 0, RF-PAL-06). The app decides
   * whether to set it; fixed nodes and texts of the board use `name`.
   */
  plainName?: string | undefined;
}

/** What the board tells the app about a slot when it asks for its hint action. */
export interface SlotHintContext {
  /** Id of the element with the role of the slot, for `aria-describedby`. */
  roleId: string;
}

export type ServiceLookup = (serviceId: string) => ServiceInfo | undefined;

/**
 * Data a draggable service carries (`useDraggable({ data })` of @dnd-kit/core) so the board can
 * emit `onServiceDrop` when it is dropped on a slot.
 */
export interface ServiceDragData {
  type: "service";
  serviceId: string;
}

export const isServiceDragData = (value: unknown): value is ServiceDragData =>
  typeof value === "object" &&
  value !== null &&
  (value as { type?: unknown }).type === "service" &&
  typeof (value as { serviceId?: unknown }).serviceId === "string";
