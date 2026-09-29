// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/sonner.tsx (clases de toastOptions tal cual; íconos por defecto de
// sonner). Solo tema claro en v1 (ADR-0021): sin next-themes.
import type * as React from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

// toast is re-exported so apps depend on a single sonner version, the one in packages/ui.
export { Toaster, toast };
