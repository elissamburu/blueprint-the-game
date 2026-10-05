// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Permissive reading of the `diagram` block for the visual editor of the Studio (ADR-0025,
// "Enmiendas", 2026-10-05). Creating an element breaks the schema at once (an empty label, a slot
// without answers), so the editor draws a draft whose only requirement is a valid geometry: ids,
// `type`, `position`, `group`, `rect`, `parent`, `from`/`to`/`step`. Texts are optional, and a
// field of the wrong type is dropped instead of the element. Each element says whether it passes
// the full schema (`incomplete`); the preview and the answers keep the last valid scenario.
import * as z from "zod";
import { EdgeSchema, GroupSchema, NODE_TYPES, NodeSchema } from "./scenario.js";

const id = z.string().trim().min(1);
const point = z.object({ x: z.number(), y: z.number() });
/** An optional field that never drops its element: a wrong type reads as missing. */
const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const DraftGroupSchema = z.object({
  id,
  kind: optional(z.string()),
  label: optional(z.string()),
  rect: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  parent: optional(z.string().nullable()),
});

const DraftNodeSchema = z.object({
  id,
  type: z.enum(NODE_TYPES),
  position: point,
  group: optional(z.string()),
  label: optional(z.string()),
  icon: optional(z.string()),
  service: optional(z.string()),
  role: optional(z.string()),
});

const DraftEdgeSchema = z.object({
  id,
  from: z.string(),
  to: z.string(),
  step: optional(z.number()),
  label: optional(z.string()),
  style: optional(z.string()),
});

const CanvasSchema = z.object({ width: z.number().positive(), height: z.number().positive() });

/** A flag of every element: it does not pass the full schema (an empty label, an unknown kind…). */
interface Completeness {
  incomplete: boolean;
}

export type DraftGroup = z.infer<typeof DraftGroupSchema> & Completeness;
export type DraftNode = z.infer<typeof DraftNodeSchema> & Completeness;
export type DraftEdge = z.infer<typeof DraftEdgeSchema> & Completeness;

export interface DiagramDraft {
  canvas: { width: number; height: number } | undefined;
  groups: DraftGroup[];
  nodes: DraftNode[];
  edges: DraftEdge[];
  /** Elements left out: without a valid geometry, or with an id already used in their list. */
  skipped: number;
}

const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
const fieldOf = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;

/**
 * The items of a list that have a valid geometry, each with the result of the full schema; the
 * second item with an id is left out (the editor names elements by id).
 */
const readList = <S extends z.ZodType<{ id: string }>>(
  value: unknown,
  draft: S,
  full: z.ZodType,
): { items: (z.infer<S> & Completeness)[]; skipped: number } => {
  const items: (z.infer<S> & Completeness)[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of listOf(value)) {
    const parsed = draft.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) {
      skipped++;
      continue;
    }
    seen.add(parsed.data.id);
    items.push({ ...parsed.data, incomplete: !full.safeParse(item).success });
  }
  return { items, skipped };
};

/** The draft of the `diagram` block of a raw document (`Document.toJS()`), never throwing. */
export const parseDiagramDraft = (diagram: unknown): DiagramDraft => {
  const groups = readList(fieldOf(diagram, "groups"), DraftGroupSchema, GroupSchema);
  const nodes = readList(fieldOf(diagram, "nodes"), DraftNodeSchema, NodeSchema);
  const edges = readList(fieldOf(diagram, "edges"), DraftEdgeSchema, EdgeSchema);
  const canvas = CanvasSchema.safeParse(fieldOf(diagram, "canvas"));
  return {
    canvas: canvas.success ? canvas.data : undefined,
    groups: groups.items,
    nodes: nodes.items,
    edges: edges.items,
    skipped: groups.skipped + nodes.skipped + edges.skipped,
  };
};
