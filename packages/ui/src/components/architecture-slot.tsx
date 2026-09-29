// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Slot of the board (RF-PLAY-02): grade, placed service, role and hint counter. Presentation only:
// the grade and the hints come through props (from game-engine, via the app) and this component
// never decides them. It fills the box its parent gives it (NODE_SIZE.slot on the board).
// Lovable: ArchitectureSlot, .architecture-slot, .slot-status, .placed-service, .empty-slot,
// .slot-main-action > p, .architecture-slot > button (src/components/blueprint-app.tsx, styles.css).
import type * as React from "react";
import { CircleHelpIcon, PlusIcon } from "lucide-react";
import { GradeBadge, gradeLabel, type SlotGrade } from "@blueprint/ui/components/grade-badge";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { cn } from "@blueprint/ui/lib/utils";

const STATES: Record<SlotGrade, string> = {
  optimal: "border-solid border-success bg-success-soft",
  acceptable: "border-solid border-warning bg-warning-soft",
  incorrect: "border-solid border-destructive bg-danger-soft",
  // Accessibility change (docs/design/tokens.css): --slot-border (3,35:1) instead of --border.
  empty: "border-dashed border-slot-border bg-card",
};

export interface ArchitectureSlotService {
  name: string;
  /** Catalog category id: color of the icon fallback. */
  category: string;
  /** Icon URL (apps/web: icons/<serviceId>.svg); without it, ServiceIcon shows the initials. */
  iconSrc?: string | undefined;
}

export type ArchitectureSlotProps = Omit<React.ComponentProps<"div">, "children" | "role"> & {
  grade: SlotGrade;
  /** Role of the slot in the architecture (scenario `role`). Always shown whole. */
  role: string;
  /** Service placed in the slot; without it the slot shows the empty placeholder. */
  service?: ArchitectureSlotService | undefined;
  /** Hints revealed and available. The counter is hidden when the slot has none. */
  hints?: { used: number; total: number } | undefined;
  /** The slot is the current target of the keyboard/tap flow (selectSlot). */
  selected?: boolean;
  /** A dragged service is over the slot. */
  dropActive?: boolean;
  /**
   * Makes the slot a button (Enter/Space/click) that calls it. Without it the slot is not
   * focusable: a control that does nothing would only add noise to the Tab order.
   */
  onActivate?: (() => void) | undefined;
  /** Text of the empty placeholder. */
  emptyText?: string | undefined;
  /**
   * Replaces the hint counter row, e.g. with a "Ver pista" button and its popover. Rendered
   * outside the main button (buttons cannot nest).
   */
  hintAction?: React.ReactNode;
};

/**
 * Accessible name of a slot: "<rol>. <estado>[: <servicio>]". Roles are sentences that often end
 * in a period already; it is not doubled.
 */
export const slotAccessibleName = (role: string, grade: SlotGrade, serviceName?: string): string =>
  `${role.trim().replace(/\.+$/, "")}. ${gradeLabel(grade)}${serviceName === undefined ? "" : `: ${serviceName}`}`;

function ArchitectureSlot({
  grade,
  role,
  service,
  hints,
  selected = false,
  dropActive = false,
  onActivate,
  emptyText = "Arrastrá o elegí un servicio",
  hintAction,
  className,
  ...props
}: ArchitectureSlotProps) {
  const body = (
    <>
      <GradeBadge grade={grade} />
      {/* Service and placeholder share the height, so the slot does not jump when it fills. */}
      {service !== undefined ? (
        <span className="mt-[0.3rem] flex h-[36px] items-center gap-[0.4rem] rounded-[5px] bg-card px-[0.3rem] text-[0.68rem] leading-tight">
          <ServiceIcon
            src={service.iconSrc}
            name={service.name}
            category={service.category}
            decorative
            className="size-7"
          />
          <strong className="line-clamp-2 min-w-0">{service.name}</strong>
        </span>
      ) : (
        <span className="mt-[0.3rem] flex h-[36px] items-center justify-center gap-[0.3rem] rounded-[5px] border border-dashed border-border px-[0.3rem] text-left text-[0.61rem] leading-tight text-muted-foreground">
          <PlusIcon aria-hidden="true" className="size-4 shrink-0" />
          {emptyText !== "" && <span>{emptyText}</span>}
        </span>
      )}
      {/* Never clamped: the whole role is the clue (it wraps inside NODE_SIZE.slot). */}
      <span className="mt-[0.3rem] text-[0.57rem] leading-[1.3] text-muted-foreground">{role}</span>
    </>
  );

  return (
    <div
      data-slot="architecture-slot"
      data-grade={grade}
      data-selected={selected ? "" : undefined}
      className={cn(
        "flex flex-col items-stretch overflow-hidden rounded-[7px] border-2 p-2 text-left shadow-[0_5px_16px_color-mix(in_oklab,var(--foreground)_6%,transparent)]",
        STATES[grade],
        selected && "ring-[3px] ring-primary",
        dropActive && "border-primary border-solid bg-blueprint-soft",
        // The focus ring of the main button is drawn around the whole slot.
        "has-[[data-slot=architecture-slot-main]:focus-visible]:outline-3 has-[[data-slot=architecture-slot-main]:focus-visible]:outline-offset-2 has-[[data-slot=architecture-slot-main]:focus-visible]:outline-ring/55",
        className,
      )}
      {...props}
    >
      {onActivate !== undefined ? (
        <button
          type="button"
          data-slot="architecture-slot-main"
          aria-label={slotAccessibleName(role, grade, service?.name)}
          aria-pressed={selected}
          onClick={onActivate}
          className="flex cursor-pointer flex-col text-left focus-visible:outline-none"
        >
          {body}
        </button>
      ) : (
        <div
          data-slot="architecture-slot-main"
          role="group"
          aria-label={slotAccessibleName(role, grade, service?.name)}
          className="flex flex-col"
        >
          {body}
        </div>
      )}
      {hintAction ??
        (hints !== undefined && hints.total > 0 && (
          <span className="mt-auto flex items-center gap-[0.3rem] pt-[0.25rem] text-[0.55rem] text-warning">
            <CircleHelpIcon aria-hidden="true" className="size-3 shrink-0" />
            Pistas {hints.used}/{hints.total}
          </span>
        ))}
    </div>
  );
}

export { ArchitectureSlot };
