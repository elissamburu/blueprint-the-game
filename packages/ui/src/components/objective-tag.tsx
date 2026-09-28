// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How a placement relates to one objective of the scenario, shown in the feedback panel
// (ADR-0007): check (met), dash (goal half met) or X ("Viola: <restriction>"). The status comes
// from game-engine through props; this component does not decide it.
import type * as React from "react";
import { CheckIcon, MinusIcon, XIcon, type LucideIcon } from "lucide-react";
import { cn } from "@blueprint/ui/lib/utils";

export type ObjectiveStatus = "met" | "partial" | "violated";

const STATUSES: Record<
  ObjectiveStatus,
  { prefix: string; visiblePrefix: boolean; icon: LucideIcon; text: string }
> = {
  met: { prefix: "Cumple", visiblePrefix: false, icon: CheckIcon, text: "text-success" },
  partial: { prefix: "A medias", visiblePrefix: false, icon: MinusIcon, text: "text-warning" },
  violated: { prefix: "Viola", visiblePrefix: true, icon: XIcon, text: "text-destructive" },
};

export type ObjectiveTagProps = React.ComponentProps<"span"> & {
  status: ObjectiveStatus;
  /** Objective text, as written in the scenario. */
  children: React.ReactNode;
};

/**
 * The accessible text is always "<status>: <objective>". For `violated` the prefix is visible
 * ("Viola: Sin servidores"); for the others it is only read by screen readers.
 */
function ObjectiveTag({ status, className, children, ...props }: ObjectiveTagProps) {
  const { prefix, visiblePrefix, icon: Icon, text } = STATUSES[status];
  return (
    <span
      data-slot="objective-tag"
      data-status={status}
      className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", text, className)}
      {...props}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />
      <span>
        <span data-slot="objective-tag-prefix" className={visiblePrefix ? undefined : "sr-only"}>
          {prefix}:{" "}
        </span>
        {children}
      </span>
    </span>
  );
}

export { ObjectiveTag };
