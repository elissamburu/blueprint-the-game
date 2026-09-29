// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Public contract of the board. The board draws what it is told: the app computes each slot
// state with game-engine and passes it here; the board only emits events.
import type { SlotGrade } from "@blueprint/ui/components/grade-badge";

export type { SlotGrade };

/** State of a slot as the board shows it. A slot without state is drawn empty. */
export interface SlotView {
  grade: SlotGrade;
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
