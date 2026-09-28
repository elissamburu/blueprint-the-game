// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Grade label of a slot (RF-PLAY, RNF-02): color is never the only cue, every grade has an icon
// and a text. The grade comes from game-engine through props; this component does not decide it.
import type * as React from "react";
import { CircleCheckIcon, CircleXIcon, MinusIcon, PlusIcon, type LucideIcon } from "lucide-react";
import { cn } from "@blueprint/ui/lib/utils";

/** Grade shown on a slot: the three evaluation grades plus `empty` (nothing placed yet). */
export type SlotGrade = "optimal" | "acceptable" | "incorrect" | "empty";

const GRADES: Record<SlotGrade, { label: string; icon: LucideIcon; text: string; soft: string }> = {
  optimal: {
    label: "Óptimo",
    icon: CircleCheckIcon,
    text: "text-success",
    soft: "bg-success-soft",
  },
  acceptable: {
    label: "Aceptable",
    icon: MinusIcon,
    text: "text-warning",
    soft: "bg-warning-soft",
  },
  incorrect: {
    label: "Incorrecto",
    icon: CircleXIcon,
    text: "text-destructive",
    soft: "bg-danger-soft",
  },
  empty: {
    label: "Vacío",
    icon: PlusIcon,
    text: "text-muted-foreground",
    soft: "bg-muted",
  },
};

export type GradeBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  grade: SlotGrade;
  /** `plain`: icon and text only (slot header). `soft`: on its grade's soft background. */
  variant?: "plain" | "soft";
};

function GradeBadge({ grade, variant = "plain", className, ...props }: GradeBadgeProps) {
  const { label, icon: Icon, text, soft } = GRADES[grade];
  return (
    <span
      data-slot="grade-badge"
      data-grade={grade}
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 text-xs font-extrabold tracking-wide whitespace-nowrap uppercase",
        text,
        variant === "soft" && ["rounded-md px-2 py-0.5", soft],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
      {label}
    </span>
  );
}

export { GradeBadge };
