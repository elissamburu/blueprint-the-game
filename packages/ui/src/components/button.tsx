// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lovable: src/components/ui/button.tsx (clases y tamaños tal cual). Diferencia de accesibilidad:
// sin focus-visible:outline-none, para que se vea el foco de 3px de la capa base (globals.css).
// El tamaño sm no achica el texto (Lovable: text-xs): los botones no bajan de 0.875rem
// (docs/design, problema 28).
// Colores forzados (docs/accesibilidad.md §3): ahí el sistema quita fondos y sombras, así que un
// botón sin borde queda como texto suelto. Las variantes sin borde propio llevan uno transparente,
// que ese modo pinta (https://developer.mozilla.org/en-US/docs/Web/CSS/@media/forced-colors); sin
// colores forzados no se ve. `link` no lleva: se presenta como un enlace.
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@blueprint/ui/lib/utils";
import { Slot } from "radix-ui";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Texto claro sobre un color sólido no significa nada en colores forzados: las variantes
        // sólidas declaran ahí los colores de botón del sistema. La principal se distingue de
        // `outline` por el grosor del borde, no por el color.
        default:
          "border border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/90 forced-colors:border-2 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]",
        destructive:
          "border border-transparent bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 forced-colors:bg-[ButtonFace] forced-colors:text-[ButtonText]",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "border border-transparent hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
