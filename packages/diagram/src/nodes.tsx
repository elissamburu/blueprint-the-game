// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Custom React Flow nodes, one per diagram type (ADR-0005), plus the groups as parent nodes.
// Lovable: .diagram-group + .group-*, .diagram-fixed-node, .diagram-actor (src/styles.css).
import type { ActorNode as ActorSchemaNode, GroupKind } from "@blueprint/scenario-schema";
import { ArchitectureSlot } from "@blueprint/ui/components/architecture-slot";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { cn } from "@blueprint/ui/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  AppWindowIcon,
  Building2Icon,
  ServerIcon,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useDiagramContext } from "./context";
import type { ActorFlowNode, FixedFlowNode, GroupFlowNode, SlotFlowNode } from "./flow-model";

const GROUP_STYLES: Record<GroupKind, string> = {
  "aws-cloud":
    "border-2 border-solid border-primary bg-[color-mix(in_oklab,var(--blueprint-soft)_58%,transparent)]",
  region:
    "border border-dashed border-primary bg-[color-mix(in_oklab,var(--card)_65%,transparent)]",
  vpc: "border border-solid border-success bg-[color-mix(in_oklab,var(--success-soft)_50%,transparent)]",
  az: "border border-dashed border-warning bg-[color-mix(in_oklab,var(--warning-soft)_38%,transparent)]",
  "subnet-public":
    "border border-solid border-border bg-[color-mix(in_oklab,var(--background)_80%,transparent)]",
  "subnet-private":
    "border border-solid border-border bg-[color-mix(in_oklab,var(--background)_80%,transparent)]",
  // Not in the prototype: neutral, dashed so it does not look like a network boundary.
  account: "border border-dashed border-slot-border",
  "on-premises": "border border-dashed border-slot-border bg-muted/60",
  generic: "border border-dashed border-slot-border",
};

/**
 * React Flow only draws an edge between nodes with handles. The board computes the edge ends
 * itself (geometry.ts), so the handles are invisible and cannot be used to connect.
 */
function HiddenHandles() {
  const style = { opacity: 0, pointerEvents: "none", left: "50%", top: "50%" } as const;
  return (
    <>
      <Handle type="target" position={Position.Top} isConnectable={false} style={style} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={style} />
    </>
  );
}

export function GroupNode({ data }: NodeProps<GroupFlowNode>) {
  const { group } = data;
  return (
    <div
      data-group-kind={group.kind}
      className={cn("size-full rounded-[9px]", GROUP_STYLES[group.kind])}
    >
      {/* Size and offset match GROUP_LABEL (geometry.ts), which step circles avoid. */}
      <span className="absolute top-[6px] left-[8px] flex h-[18px] items-center rounded-[4px] bg-card px-[0.35rem] text-[0.6rem] leading-none font-[850] whitespace-nowrap text-primary uppercase">
        {group.label}
      </span>
    </div>
  );
}

const ACTOR_ICONS: Record<ActorSchemaNode["icon"], LucideIcon> = {
  user: UserIcon,
  users: UsersIcon,
  mobile: SmartphoneIcon,
  browser: AppWindowIcon,
  server: ServerIcon,
  "third-party": Building2Icon,
};

export function ActorNode({ data }: NodeProps<ActorFlowNode>) {
  const { node } = data;
  const Icon = ACTOR_ICONS[node.icon];
  return (
    <>
      <HiddenHandles />
      <div
        data-node-type={node.type}
        className={cn(
          "flex size-full flex-col items-center justify-center gap-[0.3rem] rounded-[7px] border bg-card p-2 text-center shadow-[0_5px_14px_color-mix(in_oklab,var(--foreground)_7%,transparent)]",
          // An external system is not one of the actors: dashed, over the muted background.
          node.type === "external" && "border-dashed border-slot-border bg-muted",
        )}
      >
        <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
        <strong className="line-clamp-2 text-[0.68rem] leading-tight">{node.label}</strong>
      </div>
    </>
  );
}

export function FixedNode({ data }: NodeProps<FixedFlowNode>) {
  const { node, service } = data;
  const name = service?.name ?? node.service;
  return (
    <>
      <HiddenHandles />
      <div
        data-node-type="fixed"
        className="grid size-full grid-cols-[auto_1fr] items-center gap-2 rounded-[7px] border bg-card p-[0.6rem] shadow-[0_5px_14px_color-mix(in_oklab,var(--foreground)_7%,transparent)]"
      >
        <ServiceIcon
          src={service?.iconSrc}
          name={name}
          category={service?.category ?? ""}
          decorative
        />
        <strong className="line-clamp-2 text-[0.7rem] leading-tight">{name}</strong>
      </div>
    </>
  );
}

/** Registers the slot as a drop target of @dnd-kit (needs a DndContext above the board). */
function DroppableSlot({
  slotId,
  children,
}: {
  slotId: string;
  children: (over: boolean) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slotId}`, data: { slotId } });
  return (
    <div ref={setNodeRef} className="flex min-h-full w-full flex-col">
      {children(isOver)}
    </div>
  );
}

export function SlotNode({ data }: NodeProps<SlotFlowNode>) {
  const { node, view, service, box } = data;
  const { onSlotActivate, slotHintAction, droppable, reveal } = useDiagramContext();
  const hintAction = slotHintAction?.(node.id);
  const slot = (dropActive: boolean) => (
    <ArchitectureSlot
      data-slot-id={node.id}
      grade={view.grade}
      role={node.role}
      service={service}
      hints={view.hints}
      selected={view.selected ?? false}
      dropActive={dropActive}
      onActivate={onSlotActivate === undefined ? undefined : () => onSlotActivate(node.id)}
      emptyText={onSlotActivate === undefined ? "" : undefined}
      hintAction={hintAction}
      onFocus={() => reveal(box)}
      // React Flow turns pointer events off on nodes that are neither selectable nor draggable;
      // the slot is a button (and holds the hint button), so it takes them back. At least the node
      // box, taller when a larger browser font needs it: the role is never cut.
      className="pointer-events-auto min-h-full w-full grow"
    />
  );
  return (
    <>
      <HiddenHandles />
      {droppable ? <DroppableSlot slotId={node.id}>{slot}</DroppableSlot> : slot(false)}
    </>
  );
}

export const nodeTypes = {
  group: GroupNode,
  actor: ActorNode,
  external: ActorNode,
  fixed: FixedNode,
  slot: SlotNode,
};
