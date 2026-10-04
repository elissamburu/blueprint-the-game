// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/progress.tsx. The indicator slides 400 ms (docs/design/motion-spec.md)
// and jumps with reduced motion: Lovable's transition-all ignored prefers-reduced-motion.
import * as React from "react";
import { cn } from "@blueprint/ui/lib/utils";
import { Progress as ProgressPrimitive } from "radix-ui";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-transform duration-(--motion-duration-progress) ease-motion-out motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
