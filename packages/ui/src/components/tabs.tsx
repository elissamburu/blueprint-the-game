// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Tabs (shadcn/ui over Radix Tabs): a tablist where the arrows move between tabs and activate
// them, Home and End go to the ends, and Tab leaves the list for the active panel. The selected
// tab is marked by its border and weight, not only by color.
import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@blueprint/ui/lib/utils";

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn("inline-flex items-end gap-1 border-b", className)}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex cursor-pointer items-center gap-2 rounded-t-md border-b-[3px] border-transparent px-4 py-2 text-base font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:border-primary data-[state=active]:font-bold data-[state=active]:text-foreground forced-colors:data-[state=active]:border-[Highlight] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
