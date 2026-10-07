// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Difficulty level of a scenario (0–400). It is not the player's rank (RF-GAM-01).
// Lovable: <Badge>NIVEL n</Badge> in the game top bar and <Badge variant="outline"> in the scenario
// cards (blueprint-app.tsx). The text is "Nivel n" in uppercase through CSS, so screen readers
// read a word instead of spelling it.
import type * as React from "react";
import { Badge } from "@blueprint/ui/components/badge";
import { cn } from "@blueprint/ui/lib/utils";

// Level 0 shows its number like the rest; its name («Ideas básicas de la nube», ADR-0027) is not
// part of the badge, which never names a level.
export type ScenarioLevel = 0 | 100 | 200 | 300 | 400;

export type LevelBadgeProps = Omit<React.ComponentProps<"span">, "children"> & {
  level: ScenarioLevel;
  /** `solid`: game top bar. `outline`: scenario cards. */
  variant?: "solid" | "outline";
};

function LevelBadge({ level, variant = "outline", className, ...props }: LevelBadgeProps) {
  return (
    <Badge
      data-slot="level-badge"
      data-level={level}
      variant={variant === "solid" ? "default" : "outline"}
      className={cn("uppercase", className)}
      {...props}
    >
      Nivel {level}
    </Badge>
  );
}

export { LevelBadge };
