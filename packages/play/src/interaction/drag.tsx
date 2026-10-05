// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Drag adapter wiring (ADR-0008): palette services are @dnd-kit draggables and the board slots
// its drop targets (@blueprint/diagram emits onServiceDrop). Only the pointer sensor: keyboard
// users place services with the slot-first and service-first adapters instead.
import { isServiceDragData, type ServiceDragData } from "@blueprint/diagram";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
  type Announcements,
} from "@dnd-kit/core";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

const serviceOf = (data: unknown): string | null =>
  isServiceDragData(data) ? data.serviceId : null;

const slotOf = (data: unknown): string | null => {
  const slotId = (data as { slotId?: unknown } | undefined)?.slotId;
  return typeof slotId === "string" ? slotId : null;
};

export function ServiceDndContext({
  serviceName,
  slotRole,
  renderOverlay,
  children,
}: {
  serviceName: (serviceId: string) => string;
  slotRole: (slotId: string) => string;
  /** What follows the pointer while a service is dragged. */
  renderOverlay: (serviceId: string) => ReactNode;
  children: ReactNode;
}) {
  const { t } = useTranslation("play");
  const [dragging, setDragging] = useState<string | null>(null);
  // A small distance keeps a plain click on a palette item a click (service-first adapter).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const announcements = useMemo((): Announcements => {
    const name = (data: unknown) => {
      const id = serviceOf(data);
      return id === null ? "" : serviceName(id);
    };
    const target = (data: unknown) => {
      const id = slotOf(data);
      return id === null ? null : slotRole(id);
    };
    return {
      onDragStart: ({ active }) => t("drag.start", { service: name(active.data.current) }),
      onDragOver: ({ active, over }) => {
        const role = target(over?.data.current);
        return role === null
          ? t("drag.outside", { service: name(active.data.current) })
          : t("drag.over", { service: name(active.data.current), role });
      },
      // The placement itself is announced by the feedback panel.
      onDragEnd: ({ over }) => (target(over?.data.current) === null ? t("drag.cancel") : ""),
      onDragCancel: () => t("drag.cancel"),
    };
  }, [serviceName, slotRole, t]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "" } }}
      onDragStart={({ active }) => setDragging(serviceOf(active.data.current))}
      onDragEnd={() => setDragging(null)}
      onDragCancel={() => setDragging(null)}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        {dragging === null ? null : renderOverlay(dragging)}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * Makes a palette item draggable. Only the pointer listeners are spread: the item stays a
 * regular button for the keyboard adapters, without @dnd-kit's role and instructions.
 */
export const useServiceDraggable = (serviceId: string) => {
  const data: ServiceDragData = { type: "service", serviceId };
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `service:${serviceId}`, data });
  return { setNodeRef, listeners, isDragging };
};
