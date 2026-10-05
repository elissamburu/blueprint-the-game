// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/label.tsx (clases tal cual).
import * as React from "react";
import { cn } from "@blueprint/ui/lib/utils";
import { Label as LabelPrimitive } from "radix-ui";

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
