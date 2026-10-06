// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Structural schema of content/scenarios/<id>/scenario.yaml (docs/03 §2, schemaVersion 1).
// Cross-data checks (catalog lookups, leaks, referenced ids, overlaps) belong to content-lint.
import * as z from "zod";
import {
  MAX_LENGTH,
  discriminatorMessage,
  discriminatorOf,
  OFFICIAL_DOC_HOSTS,
  httpsUrl,
  isOfficialReference,
  kebabId,
  level,
  oneOf,
  positiveInt,
  text,
} from "./common.js";

export const SCENARIO_STATUSES = ["draft", "beta", "published", "retired"] as const;
export const OBJECTIVE_KINDS = ["hard", "soft"] as const;
export const OBJECTIVE_CATEGORIES = [
  "cost",
  "traffic",
  "operations",
  "latency",
  "security",
  "compliance",
  "durability",
  "availability",
  "scalability",
  "performance",
  "team",
] as const;
export const GROUP_KINDS = [
  "aws-cloud",
  "region",
  "vpc",
  "az",
  "subnet-public",
  "subnet-private",
  "account",
  "on-premises",
  "generic",
] as const;
export const NODE_TYPES = ["actor", "external", "fixed", "slot"] as const;
export const ACTOR_ICONS = ["user", "users", "mobile", "browser", "server", "third-party"] as const;

/**
 * Logical size (canvas units) of the box each node type occupies; `position` is its top-left
 * corner. Part of the content contract (docs/03 §2): the renderer draws with it and lint L007
 * checks canvas bounds, group membership and overlaps with it.
 */
export const NODE_SIZE = {
  actor: { w: 120, h: 80 },
  external: { w: 120, h: 80 },
  fixed: { w: 160, h: 80 },
  slot: { w: 160, h: 160 },
} as const satisfies Record<(typeof NODE_TYPES)[number], { w: number; h: number }>;
export const GRADES = ["optimal", "acceptable"] as const;
export const EDGE_STYLES = ["sync", "async", "data", "control"] as const;
export const PALETTE_MODES = ["auto", "curated", "categories", "categories-plus", "full"] as const;

/** GitHub username rules: alphanumerics and single inner hyphens, up to 39 characters. */
const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export const PersonSchema = z.strictObject({
  github: z.string().regex(GITHUB_USER, {
    error: (iss) =>
      iss.input === undefined
        ? undefined
        : `${JSON.stringify(iss.input)} no es un usuario de GitHub válido`,
  }),
});

export const ObjectiveSchema = z.strictObject({
  id: kebabId(),
  kind: oneOf(OBJECTIVE_KINDS, "kind"),
  category: oneOf(OBJECTIVE_CATEGORIES, "category"),
  text: text(),
});

const PointSchema = z.strictObject({ x: z.number(), y: z.number() });

export const GroupSchema = z.strictObject({
  id: kebabId(),
  kind: oneOf(GROUP_KINDS, "kind"),
  label: text(MAX_LENGTH.label),
  rect: z.strictObject({
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  parent: kebabId().nullable().optional().describe("Id del grupo padre (anidamiento) o null."),
});

/**
 * Where the analogy of an answer stops being true (ADR-0027 §2). It carries its own official
 * references because it states a different AWS fact than the one that justifies the grade.
 */
export const AnalogyLimitSchema = z.strictObject({
  text: text(MAX_LENGTH.analogyLimit).describe("Markdown corto: dónde se rompe la analogía."),
  references: z
    .array(
      httpsUrl().refine(isOfficialReference, {
        error: (iss) =>
          `${JSON.stringify(iss.input)} no es documentación oficial: usá ${OFFICIAL_DOC_HOSTS.join(" o ")}`,
      }),
    )
    .min(1, { error: "Dónde se rompe la analogía necesita al menos una referencia oficial" })
    .describe(`≥ 1, documentación oficial (${OFFICIAL_DOC_HOSTS.join(" o ")}).`),
});

export const AnswerSchema = z.strictObject({
  service: kebabId().describe("Id de content/catalog/services.yaml."),
  grade: oneOf(GRADES, "grade").describe(
    'optimal | acceptable. Los servicios incorrectos van en "incorrect".',
  ),
  objectives: z
    .array(kebabId())
    .min(1, { error: "Tiene que referenciar al menos un objetivo que justifique el grado" }),
  rationale: text(MAX_LENGTH.rationale),
  references: z.array(httpsUrl()).default([]),
  analogyLimit: AnalogyLimitSchema.optional().describe(
    "Dónde se rompe la analogía. Se muestra después de colocar, como la rationale.",
  ),
});

export const IncorrectSchema = z.strictObject({
  service: kebabId().describe("Id de content/catalog/services.yaml."),
  violates: z.array(kebabId()).optional().describe("Ids de objetivos que viola."),
  rationale: text(MAX_LENGTH.rationale).describe(
    "Explicación específica. Si no hay una, el servicio va en palette.extra.",
  ),
});

const nodeBase = {
  id: kebabId(),
  position: PointSchema,
  group: kebabId().optional().describe("Id del grupo que contiene al nodo."),
};

export const ActorNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal("actor"),
  label: text(MAX_LENGTH.label),
  icon: oneOf(ACTOR_ICONS, "icon"),
});

export const ExternalNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal("external"),
  label: text(MAX_LENGTH.label),
  icon: oneOf(ACTOR_ICONS, "icon"),
});

export const FixedNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal("fixed"),
  service: kebabId().describe("Servicio visible desde el inicio (id del catálogo)."),
});

export const SlotNodeSchema = z.strictObject({
  ...nodeBase,
  type: z.literal("slot"),
  role: text(MAX_LENGTH.role),
  answers: z.array(AnswerSchema).min(1, { error: "Un casillero necesita al menos una respuesta" }),
  incorrect: z.array(IncorrectSchema).default([]),
  hints: z.array(text()).max(3, { error: "Un casillero admite como máximo 3 pistas" }).default([]),
});

export const NodeSchema = z.discriminatedUnion(
  "type",
  [ActorNodeSchema, ExternalNodeSchema, FixedNodeSchema, SlotNodeSchema],
  {
    error: (iss) => {
      const type = discriminatorOf(iss.input, "type");
      return (
        `El nodo necesita "type" con uno de estos valores: ${NODE_TYPES.map((t) => `"${t}"`).join(", ")}` +
        (type === undefined ? "" : ` (recibido: ${JSON.stringify(type)})`)
      );
    },
  },
);

export const EdgeSchema = z.strictObject({
  id: kebabId(),
  from: kebabId(),
  to: kebabId(),
  step: positiveInt().describe("Orden en el reproductor de flujo; pasos iguales = en paralelo."),
  label: text(MAX_LENGTH.label),
  description: text().optional(),
  style: oneOf(EDGE_STYLES, "style"),
});

export const DiagramSchema = z.strictObject({
  canvas: z.strictObject({ width: z.number().positive(), height: z.number().positive() }),
  groups: z.array(GroupSchema).default([]),
  nodes: z.array(NodeSchema).min(1, { error: "El diagrama necesita al menos un nodo" }),
  edges: z.array(EdgeSchema).default([]),
});

const paletteExtra = z
  .array(kebabId())
  .default([])
  .describe("Distractores extra, sin explicación específica.");

/**
 * `maxSize` only makes sense when the palette is curated: explicitly, or through `auto`
 * when the scenario level resolves to `curated` in game-rules.
 */
export const PaletteSchema = z.discriminatedUnion(
  "mode",
  [
    z.strictObject({
      mode: z.literal(["auto", "curated"]),
      maxSize: positiveInt().optional(),
      extra: paletteExtra,
    }),
    z.strictObject({
      mode: z.literal(["categories", "categories-plus", "full"]),
      extra: paletteExtra,
    }),
  ],
  {
    error: (iss) => discriminatorMessage(iss.input, "mode", "palette.mode", PALETTE_MODES),
  },
);

export const ScenarioReferenceSchema = z.strictObject({
  title: text(),
  url: httpsUrl(),
});

export const ScenarioSchema = z
  .strictObject({
    schemaVersion: z.literal(1, { error: "schemaVersion tiene que ser 1" }),
    id: kebabId()
      .min(3, { error: "El id del escenario tiene que tener al menos 3 caracteres" })
      .max(64, { error: "El id del escenario puede tener como máximo 64 caracteres" })
      .describe("= nombre de la carpeta. Inmutable una vez publicado."),
    version: positiveInt().describe(
      "Versión del contenido; incrementar si cambian respuestas o grados.",
    ),
    status: oneOf(SCENARIO_STATUSES, "status"),
    lang: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, {
      error: (iss) =>
        iss.input === undefined
          ? undefined
          : `${JSON.stringify(iss.input)} no es un idioma válido (p. ej. "es" o "es-AR")`,
    }),
    level: level(),
    areas: z
      .array(kebabId())
      .min(1, { error: "El escenario tiene que pertenecer al menos a un área" })
      .describe("Ids de content/areas.yaml."),
    title: text(MAX_LENGTH.title),
    summary: text(MAX_LENGTH.summary),
    estimatedMinutes: positiveInt(),
    authors: z.array(PersonSchema).min(1, { error: "El escenario necesita al menos un autor" }),
    contributors: z.array(PersonSchema).default([]),
    context: text().describe("Markdown: narrativa del caso de negocio."),
    objectives: z
      .array(ObjectiveSchema)
      .min(1, { error: "El escenario necesita al menos un objetivo" }),
    diagram: DiagramSchema,
    palette: PaletteSchema.optional(),
    references: z.array(ScenarioReferenceSchema).default([]),
  })
  .meta({
    title: "Escenario de Blueprint",
    description: "Formato de content/scenarios/<id>/scenario.yaml (schemaVersion 1). Ver docs/03.",
  });

export type Scenario = z.infer<typeof ScenarioSchema>;
export type ScenarioInput = z.input<typeof ScenarioSchema>;
export type Person = z.infer<typeof PersonSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];
export type ObjectiveCategory = (typeof OBJECTIVE_CATEGORIES)[number];
export type Diagram = z.infer<typeof DiagramSchema>;
export type Group = z.infer<typeof GroupSchema>;
export type GroupKind = (typeof GROUP_KINDS)[number];
export type DiagramNode = z.infer<typeof NodeSchema>;
export type NodeType = DiagramNode["type"];
export type ActorNode = z.infer<typeof ActorNodeSchema>;
export type ExternalNode = z.infer<typeof ExternalNodeSchema>;
export type FixedNode = z.infer<typeof FixedNodeSchema>;
export type SlotNode = z.infer<typeof SlotNodeSchema>;
export type Answer = z.infer<typeof AnswerSchema>;
export type AnalogyLimit = z.infer<typeof AnalogyLimitSchema>;
export type Grade = (typeof GRADES)[number];
export type Incorrect = z.infer<typeof IncorrectSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type EdgeStyle = (typeof EDGE_STYLES)[number];
export type Palette = z.infer<typeof PaletteSchema>;
export type PaletteMode = (typeof PALETTE_MODES)[number];
export type ScenarioReference = z.infer<typeof ScenarioReferenceSchema>;
