// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Grade label of a slot (RF-PLAY, RNF-02): color is never the only cue, every grade has an icon
// and a text. The grade comes from game-engine through props; this component does not decide it.
// Lovable: .slot-status (src/styles.css) and statusStyle in blueprint-app.tsx.
import type * as React from "react";
import {
  CircleCheckIcon,
  CircleXIcon,
  EyeIcon,
  MinusIcon,
  PlusIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@blueprint/ui/lib/utils";

/**
 * Grade shown on a slot: the three evaluation grades, `empty` (nothing placed yet) and
 * `revealed` (the player viewed the solution, RF-PLAY-14: it shows the optimal answer but it is
 * not a green, so it has its own icon, text and the blueprint color instead of success).
 */
export type SlotGrade = "optimal" | "acceptable" | "incorrect" | "empty" | "revealed";

const GRADES: Record<SlotGrade, { label: string; icon: LucideIcon; text: string }> = {
  optimal: { label: "Óptimo", icon: CircleCheckIcon, text: "text-success" },
  acceptable: { label: "Aceptable", icon: MinusIcon, text: "text-warning" },
  incorrect: { label: "Incorrecto", icon: CircleXIcon, text: "text-destructive" },
  empty: { label: "Vacío", icon: PlusIcon, text: "text-muted-foreground" },
  // blueprint / blueprint-soft: 7,25:1 (docs/design/tokens.css).
  revealed: { label: "Solución vista", icon: EyeIcon, text: "text-blueprint" },
};

/** Visible text of a grade ("Óptimo", "Vacío"…), also for accessible names that include it. */
export const gradeLabel = (grade: SlotGrade): string => GRADES[grade].label;

export type GradeBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  grade: SlotGrade;
};

function GradeBadge({ grade, className, ...props }: GradeBadgeProps) {
  const { label, icon: Icon, text } = GRADES[grade];
  return (
    <span
      data-slot="grade-badge"
      data-grade={grade}
      className={cn(
        "inline-flex items-center gap-[0.3rem] text-[0.61rem] font-[850] whitespace-nowrap uppercase",
        text,
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      {label}
    </span>
  );
}

export { GradeBadge };
