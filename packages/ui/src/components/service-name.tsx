// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Name of a level 0 card (ADR-0027 §6, RF-PAL-06): the plain name on top and the real name below,
// smaller and in --muted-foreground. Read as one name, «Almacenamiento de archivos (Amazon S3)»:
// the parentheses are text for screen readers only. Whether a card shows a plain name is decided
// by the app (packages/play), not here; without one the caller shows the name as always.
import type * as React from "react";
import { cn } from "@blueprint/ui/lib/utils";

/** «<plainName> (<name>)»: the accessible name of a card that shows a plain name. */
export const doubleName = (plainName: string, name: string): string => `${plainName} (${name})`;

export type ServiceNameProps = Omit<React.ComponentProps<"span">, "children"> & {
  /** Plain name, shown on top. */
  plainName: string;
  /** Real name of the service or concept, shown below. */
  name: string;
  /** Size of the real name: ≥ 0.75rem outside the board, ≥ 12 px on it. */
  nameClassName?: string | undefined;
};

function ServiceName({ plainName, name, nameClassName, className, ...props }: ServiceNameProps) {
  return (
    <span data-slot="service-name" className={cn("flex min-w-0 flex-col", className)} {...props}>
      <span data-slot="service-name-plain">{plainName}</span>{" "}
      {/* Screen readers read the sr-only copy, with its parentheses, and skip the visible one: a
          whole text node is read the same in every browser, whatever the display of each part. */}
      <span
        aria-hidden
        data-slot="service-name-real"
        className={cn("font-normal text-muted-foreground", nameClassName)}
      >
        {name}
      </span>
      <span className="sr-only">({name})</span>
    </span>
  );
}

export { ServiceName };
