// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Radio option shown as a card, for the onboarding experience question. Lovable: .experience-option,
// .level-number and .radio-dot (src/styles.css) with the markup of the onboarding in
// blueprint-app.tsx. It is a Radix RadioGroup item, so it keeps the radiogroup semantics
// (arrow keys, aria-checked) that Lovable's pressed buttons did not have.
// Accessibility change: the empty radio dot uses --slot-border (3:1) instead of --border (1.43:1),
// because it is what shows the unchecked state (WCAG 1.4.11).
import * as React from "react";
import { useId } from "react";
import { cn } from "@blueprint/ui/lib/utils";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

export type RadioCardItemProps = Omit<
  React.ComponentProps<typeof RadioGroupPrimitive.Item>,
  "children"
> & {
  /** Short marker in the square on the left (the option number in the onboarding). */
  marker: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
};

function RadioCardItem({ marker, title, description, className, ...props }: RadioCardItemProps) {
  const id = useId();
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-card"
      aria-labelledby={`${id}-title`}
      aria-describedby={description === undefined ? undefined : `${id}-description`}
      className={cn(
        "group grid min-h-[76px] cursor-pointer grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border bg-card p-3 text-left text-foreground",
        "hover:border-primary hover:bg-blueprint-soft data-[state=checked]:border-primary data-[state=checked]:bg-blueprint-soft",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="grid size-7 place-items-center rounded-md bg-muted text-xs font-extrabold text-muted-foreground group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground"
      >
        {marker}
      </span>
      <span>
        <strong id={`${id}-title`} className="block">
          {title}
        </strong>
        {description !== undefined && (
          <small
            id={`${id}-description`}
            className="mt-[0.2rem] block text-[0.7rem] leading-[1.35] text-muted-foreground"
          >
            {description}
          </small>
        )}
      </span>
      <span
        aria-hidden="true"
        className="size-4 rounded-full border-2 border-slot-border group-data-[state=checked]:border-[5px] group-data-[state=checked]:border-primary"
      />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioCardItem };
