// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Custom React Flow nodes, one per diagram type (ADR-0005), plus the groups as parent nodes. Sizes
// are in px: on the board, text scales with the board zoom, not with the browser font (the nodes
// have fixed canvas sizes; docs/design, problem 28).
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
  CircleHelpIcon,
  ServerIcon,
  SmartphoneIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactNode } from "react";
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
 * Class (React Flow's default `noPanClassName`) of the board controls: a press that starts on them
 * never pans the board. Without it a press that moves a pixel or two starts the pan of d3-zoom,
 * which then swallows the click. It does not stop the wheel: panOnScroll only checks `nowheel`.
 */
export const NO_PAN = "nopan";

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
      <span className="absolute top-[6px] left-[8px] flex h-[18px] items-center rounded-[4px] bg-card px-[5.6px] text-[9.6px] leading-none font-[850] whitespace-nowrap text-primary uppercase">
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
          "flex size-full flex-col items-center justify-center gap-[4.8px] rounded-[7px] border bg-card p-[8px] text-center shadow-[0_5px_14px_color-mix(in_oklab,var(--foreground)_7%,transparent)]",
          // An external system is not one of the actors: dashed, over the muted background.
          node.type === "external" && "border-dashed border-slot-border bg-muted",
        )}
      >
        <Icon aria-hidden="true" className="size-[20px] shrink-0 text-muted-foreground" />
        <strong className="line-clamp-2 text-[10.88px] leading-tight">{node.label}</strong>
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
        className="grid size-full grid-cols-[auto_1fr] items-center gap-[8px] rounded-[7px] border bg-card p-[9.6px] shadow-[0_5px_14px_color-mix(in_oklab,var(--foreground)_7%,transparent)]"
      >
        <ServiceIcon
          src={service?.iconSrc}
          name={name}
          category={service?.category ?? ""}
          decorative
          className="text-[9.28px]"
        />
        <strong className="line-clamp-2 text-[11.2px] leading-tight">{name}</strong>
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

/** Slot of the preview: an empty dashed box with a question mark, as in the brief (captura 12). */
function PreviewSlot() {
  return (
    <div
      data-slot="architecture-slot"
      data-grade="empty"
      className="grid size-full place-items-center rounded-[7px] border-2 border-dashed border-primary bg-card"
    >
      <CircleHelpIcon aria-hidden="true" className="size-1/3 text-primary" />
    </div>
  );
}

export function SlotNode({ data }: NodeProps<SlotFlowNode>) {
  const { node, view, service, box } = data;
  const { onSlotActivate, slotHintAction, droppable, reveal, preview } = useDiagramContext();
  const roleId = useId();
  if (preview) {
    return (
      <>
        <HiddenHandles />
        <PreviewSlot />
      </>
    );
  }
  const hintAction = slotHintAction?.(node.id, { roleId });
  const interactive = onSlotActivate !== undefined || hintAction !== undefined;
  const slot = (dropActive: boolean) => (
    <ArchitectureSlot
      data-slot-id={node.id}
      grade={view.grade}
      role={node.role}
      number={view.number}
      roleId={roleId}
      service={service}
      hints={view.hints}
      selected={view.selected ?? false}
      dropActive={dropActive}
      onActivate={onSlotActivate === undefined ? undefined : () => onSlotActivate(node.id)}
      emptyText={onSlotActivate === undefined ? "" : undefined}
      hintAction={hintAction}
      onFocus={(event) => reveal(box, event.currentTarget.getBoundingClientRect().height)}
      // React Flow turns pointer events off on nodes that are neither selectable nor draggable;
      // the slot is a button (and holds the hint button), so it takes them back. At least the node
      // box, taller when a larger browser font needs it: the role is never cut.
      // A press on its controls is not a pan (NO_PAN): React Flow would take any press that moves
      // a pixel or two and swallow the click, as a hand clicks (issue #48). The wheel still pans.
      className={cn("pointer-events-auto min-h-full w-full grow", interactive && NO_PAN)}
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
