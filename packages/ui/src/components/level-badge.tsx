// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Difficulty level of a scenario (100–400). It is not the player's rank (RF-GAM-01).
import type * as React from "react";
import { Badge } from "@blueprint/ui/components/badge";
import { cn } from "@blueprint/ui/lib/utils";

export type ScenarioLevel = 100 | 200 | 300 | 400;

export type LevelBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  level: ScenarioLevel;
  /** `solid`: game header. `outline`: scenario cards. */
  variant?: "solid" | "outline";
};

function LevelBadge({ level, variant = "outline", className, ...props }: LevelBadgeProps) {
  return (
    <Badge
      data-slot="level-badge"
      data-level={level}
      variant={variant === "solid" ? "default" : "outline"}
      className={cn(
        "rounded-md px-2 font-bold tracking-wide uppercase tabular-nums",
        variant === "outline" && "bg-card",
        className,
      )}
      {...props}
    >
      Nivel {level}
    </Badge>
  );
}

export { LevelBadge };
