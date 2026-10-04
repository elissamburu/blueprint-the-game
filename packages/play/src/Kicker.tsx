// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Label over a title, as the global .section-kicker (primary, bold, spaced uppercase through CSS
// so screen readers do not spell it) but at 14 px: the game keeps every label at 0.875rem or more
// (docs/design, problem 28).
import { cn } from "@blueprint/ui/lib/utils";
import type { ComponentProps } from "react";

export function Kicker({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn("text-sm font-extrabold tracking-[0.12em] text-primary uppercase", className)}
      {...props}
    />
  );
}
