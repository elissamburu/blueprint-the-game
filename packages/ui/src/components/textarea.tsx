// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/textarea.tsx (clases tal cual, sin focus-visible:outline-none: ver la
// capa base de globals.css). `aria-invalid` pinta el borde de error, como en Input.
import * as React from "react";
import { cn } from "@blueprint/ui/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
