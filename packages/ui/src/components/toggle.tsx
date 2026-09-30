// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/toggle.tsx (clases tal cual, sin focus-visible:outline-none: ver la
// capa base de globals.css). La variante `chip` traduce los chips de áreas del onboarding de
// Lovable (Button `outline` sin elegir, Button `default` elegido); con Toggle el estado queda en
// aria-pressed. En colores forzados el chip elegido declara el color de texto del sistema, como
// las variantes sólidas de Button: el claro de --primary-foreground no significa nada ahí.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@blueprint/ui/lib/utils";
import { Toggle as TogglePrimitive } from "radix-ui";

const toggleVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-sm hover:bg-accent hover:text-accent-foreground",
        chip: "border border-input bg-background whitespace-nowrap shadow-sm hover:bg-accent hover:text-accent-foreground data-[state=on]:border-transparent data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow data-[state=on]:hover:bg-primary/90 data-[state=on]:hover:text-primary-foreground forced-colors:data-[state=on]:bg-[ButtonFace] forced-colors:data-[state=on]:text-[ButtonText]",
      },
      size: {
        default: "h-9 min-w-9 px-2",
        sm: "h-8 min-w-8 px-1.5",
        lg: "h-10 min-w-10 px-2.5",
      },
    },
    compoundVariants: [{ variant: "chip", size: "default", class: "px-4 py-2" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
