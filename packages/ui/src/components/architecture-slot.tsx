// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Slot of the board (RF-PLAY-02): grade, placed service, role and hint counter. Presentation only:
// the grade and the hints come through props (from game-engine, via the app) and this component
// never decides them. It fills the box its parent gives it (NODE_SIZE.slot on the board) and grows
// past it only when the text needs more room: nothing inside is ever cut. Sizes are in px, not
// rem: on the board the text scales with the board zoom, not with the browser font, so a larger
// font never makes slots overlap (docs/design, problem 28); the board zoom goes up to 300 %.
// Lovable: ArchitectureSlot, .architecture-slot, .slot-status, .placed-service, .empty-slot,
// .slot-main-action > p, .architecture-slot > button (src/components/blueprint-app.tsx, styles.css).
// Motion (RF-PLAY-17, docs/design/motion-spec.md): the service settles and the grade appears when
// the parent says the slot changed; the grade and its text are there from the first frame.
import type { ConceptGlyph } from "@blueprint/scenario-schema";
import * as React from "react";
import { CircleHelpIcon, PlusIcon } from "lucide-react";
import { GradeBadge, gradeLabel, type SlotGrade } from "@blueprint/ui/components/grade-badge";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { doubleName, ServiceName } from "@blueprint/ui/components/service-name";
import { motionClass, type MotionMoment } from "@blueprint/ui/lib/motion";
import { cn } from "@blueprint/ui/lib/utils";

const STATES: Record<SlotGrade, string> = {
  optimal: "border-solid border-success bg-success-soft",
  acceptable: "border-solid border-warning bg-warning-soft",
  incorrect: "border-solid border-destructive bg-danger-soft",
  // Accessibility change (docs/design/tokens.css): --slot-border (3,35:1) instead of --border.
  empty: "border-dashed border-slot-border bg-card",
  // A border style of its own (double) besides the color, so "Solución vista" is told apart from a
  // green in forced colors and in black and white too (docs/accesibilidad.md §3). The padding
  // gives back the extra border width.
  revealed: "border-double border-[4px] border-blueprint bg-blueprint-soft p-[6px]",
};

/**
 * A change of the slot to animate once. A new `key` plays it again; the same key never does, so
 * the parent keeps it only until `onMotionEnd`.
 */
export interface ArchitectureSlotMotion {
  key: number;
  /** A service was placed: it settles into the slot. */
  placed: boolean;
  /** The slot got a new result: its grade appears. */
  graded: boolean;
}

/** What animates when a grade appears: the icon of a green or orange, the whole label otherwise. */
const GRADE_MOTION: Record<SlotGrade, { moment: MotionMoment; on: "icon" | "label" } | null> = {
  optimal: { moment: "optimal", on: "icon" },
  acceptable: { moment: "acceptable", on: "icon" },
  incorrect: { moment: "incorrect", on: "label" },
  revealed: { moment: "revealed", on: "label" },
  empty: null,
};

export interface ArchitectureSlotService {
  name: string;
  /** Catalog category id: color of the icon fallback. */
  category: string;
  /** Icon URL (apps/web: icons/<serviceId>.svg); without it, ServiceIcon shows the initials. */
  iconSrc?: string | undefined;
  /** Glyph of a concept, drawn instead of an icon. */
  glyph?: ConceptGlyph | undefined;
  /**
   * Plain name of a level 0 card (ADR-0027 §6): shown on top, with the name below in 12 px, and
   * part of the accessible name, «<plainName> (<name>)».
   */
  plainName?: string | undefined;
}

export type ArchitectureSlotProps = Omit<React.ComponentProps<"div">, "children" | "role"> & {
  grade: SlotGrade;
  /** Role of the slot in the architecture (scenario `role`). Always shown whole. */
  role: string;
  /**
   * Number of the slot in the scenario (game-engine `slotNumbers`, the one the summary shows).
   * With it the slot has a short name that ends in "casillero N" and the role is its description;
   * without it (a slot outside a game) the role is part of the name.
   */
  number?: number | undefined;
  /**
   * Id of the element with the role text, for the `aria-describedby` of the controls the app adds
   * to the slot (`hintAction`). Generated when missing.
   */
  roleId?: string | undefined;
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
  /** A change to animate (placement, new grade). Without it nothing moves. */
  motion?: ArchitectureSlotMotion | undefined;
  /** prefers-reduced-motion: the motion is a short fade, without transform. */
  reducedMotion?: boolean | undefined;
  /** The last animation of `motion` ended. */
  onMotionEnd?: (() => void) | undefined;
};

export interface SlotNameInput {
  role: string;
  grade: SlotGrade;
  number?: number | undefined;
  serviceName?: string | undefined;
  /** Placeholder the empty slot shows ("" when it shows none). */
  emptyText?: string | undefined;
}

/**
 * Accessible name of a slot. With its number it is short and unique on the board, and it starts
 * with the text the slot shows (WCAG 2.5.3): "Óptimo: Amazon S3, casillero 2", "Arrastrá o elegí
 * un servicio, casillero 3". The role is then the description of the slot, not part of its name
 * (WCAG 2.4.6). Without a number: "<rol>. <estado>[: <servicio>]"; roles are sentences that often
 * end in a period already, so it is not doubled.
 */
export const slotAccessibleName = ({
  role,
  grade,
  number,
  serviceName,
  emptyText = "",
}: SlotNameInput): string => {
  const state = `${gradeLabel(grade)}${serviceName === undefined ? "" : `: ${serviceName}`}`;
  if (number === undefined) return `${role.trim().replace(/\.+$/, "")}. ${state}`;
  const shown = serviceName === undefined && emptyText !== "" ? emptyText : state;
  return `${shown}, casillero ${number}`;
};

function ArchitectureSlot({
  grade,
  role,
  number,
  roleId,
  service,
  hints,
  selected = false,
  dropActive = false,
  onActivate,
  emptyText = "Arrastrá o elegí un servicio",
  hintAction,
  motion,
  reducedMotion = false,
  onMotionEnd,
  className,
  ...props
}: ArchitectureSlotProps) {
  const generatedId = React.useId();
  const roleTextId = roleId ?? generatedId;
  // Name and description of the slot, on the button or on the group that stands for it.
  const labelling = {
    "aria-label": slotAccessibleName({
      role,
      grade,
      number,
      serviceName:
        service?.plainName === undefined
          ? service?.name
          : doubleName(service.plainName, service.name),
      emptyText,
    }),
    "aria-describedby": number === undefined ? undefined : roleTextId,
  };
  const gradeMotion = motion?.graded === true ? GRADE_MOTION[grade] : null;
  const gradeClass =
    gradeMotion === null ? undefined : motionClass(gradeMotion.moment, reducedMotion);
  const settles = motion?.placed === true;
  // Remounted with each motion, so the same animation plays again on the next change. The grade
  // lasts longer than the settle, so its end is the end of the motion.
  const motionKey = (part: string) => (motion === undefined ? part : `${part}-${motion.key}`);
  const ended = (last: boolean) =>
    last && onMotionEnd !== undefined
      ? (event: React.AnimationEvent) => {
          event.stopPropagation();
          onMotionEnd();
        }
      : undefined;
  const body = (
    <>
      <GradeBadge
        key={motionKey("grade")}
        grade={grade}
        className={cn(
          "gap-[4.8px] text-[9.76px] [&_svg]:size-[14px]",
          gradeMotion?.on === "label" && gradeClass,
        )}
        iconClassName={gradeMotion?.on === "icon" ? gradeClass : undefined}
        onAnimationEnd={ended(gradeMotion !== null)}
      />
      {/* Service and placeholder share the height, so the slot does not jump when it fills. */}
      {service !== undefined ? (
        <span
          key={motionKey("service")}
          data-slot="architecture-slot-service"
          className={cn(
            "mt-[4.8px] flex min-h-[36px] items-center gap-[6.4px] rounded-[5px] bg-card px-[4.8px] text-[10.88px] leading-tight",
            // Two names: the icon sits at the top, level with the first line, in every slot.
            service.plainName !== undefined && "items-start py-[4px]",
            settles && motionClass("settle", reducedMotion),
          )}
          onAnimationEnd={ended(settles && gradeMotion === null)}
        >
          <ServiceIcon
            src={service.iconSrc}
            glyph={service.glyph}
            name={service.name}
            category={service.category}
            decorative
            className="size-[28px] text-[9.28px]"
          />
          {service.plainName === undefined ? (
            <strong className="line-clamp-2 min-w-0">{service.name}</strong>
          ) : (
            // The plain name is bigger than the 12 px of the real name below it, the minimum on the
            // board for it; the slot grows when they need more room.
            <ServiceName
              plainName={service.plainName}
              name={service.name}
              nameClassName="text-[12px]"
              className="flex-1 text-[13.6px] font-bold"
            />
          )}
        </span>
      ) : (
        <span className="mt-[4.8px] flex min-h-[36px] items-center justify-center gap-[4.8px] rounded-[5px] border border-dashed border-border px-[4.8px] text-left text-[9.76px] leading-tight text-muted-foreground">
          <PlusIcon aria-hidden="true" className="size-[16px] shrink-0" />
          {emptyText !== "" && <span>{emptyText}</span>}
        </span>
      )}
      {/* Never clamped nor clipped: the whole role is the clue. It wraps inside NODE_SIZE.slot and,
          if it ever needs more room, the slot grows downward instead of cutting it. */}
      <span
        id={roleTextId}
        className="mt-[4.8px] text-[9.12px] leading-[1.3] text-muted-foreground"
      >
        {role}
      </span>
    </>
  );

  return (
    <div
      data-slot="architecture-slot"
      data-grade={grade}
      data-selected={selected ? "" : undefined}
      className={cn(
        "flex flex-col items-stretch rounded-[7px] border-2 p-[8px] text-left shadow-[0_5px_16px_color-mix(in_oklab,var(--foreground)_6%,transparent)]",
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
          {...labelling}
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
          {...labelling}
          className="flex flex-col"
        >
          {body}
        </div>
      )}
      {hintAction ??
        (hints !== undefined && hints.total > 0 && (
          <span className="mt-auto flex items-center gap-[4.8px] pt-[4px] text-[8.8px] text-warning">
            <CircleHelpIcon aria-hidden="true" className="size-[12px] shrink-0" />
            Pistas {hints.used}/{hints.total}
          </span>
        ))}
    </div>
  );
}

export { ArchitectureSlot };
