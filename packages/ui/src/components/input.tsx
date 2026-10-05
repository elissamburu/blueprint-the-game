// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/input.tsx (clases tal cual, sin focus-visible:outline-none: ver la
// capa base de globals.css). Un campo con `aria-invalid` lleva el borde de error, que acompaña al
// mensaje asociado con aria-describedby (el color nunca es la única señal).
import * as React from "react";
import { cn } from "@blueprint/ui/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
