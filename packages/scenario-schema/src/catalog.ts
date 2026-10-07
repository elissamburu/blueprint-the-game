// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Structural schemas of content/catalog/*.yaml (docs/03 §4–§6, RF-CAT-01..03, RF-CAT-07).
import * as z from "zod";
import { discriminatorMessage, httpsUrl, kebabId, oneOf, positiveInt, text } from "./common.js";

export const SERVICE_STATUSES = ["active", "deprecated"] as const;

/** Kinds of catalog entries (ADR-0027 §1). A missing `type` means `service`. */
export const ENTRY_TYPES = ["service", "concept"] as const;

/** Kinds of categories: a concept goes in a `concept` category, a service in a `service` one. */
export const CATEGORY_KINDS = ["service", "concept"] as const;

/** Maximum length of `plainName`: it is the big name of a level 0 card (ADR-0027 §6). */
export const PLAIN_NAME_MAX_LENGTH = 40;

/**
 * Closed set of glyphs for concepts, which have no official icon (ADR-0027 §1). The package
 * stays pure: packages/ui maps each value to a lucide-react icon (map and test in F2.1 PR 4).
 * Planned mapping, checked against lucide-react 1.48.0:
 *   region                → MapPin
 *   availability-zone     → Building2
 *   edge-location         → RadioTower
 *   global-network        → Globe
 *   shared-responsibility → Handshake
 *   pay-as-you-go         → Receipt
 *   savings               → PiggyBank
 *   elasticity            → Scaling
 *   high-availability     → Layers
 *   fault-tolerance       → LifeBuoy
 *   security              → ShieldCheck
 *   compliance            → ClipboardCheck
 */
export const CONCEPT_GLYPHS = [
  "region",
  "availability-zone",
  "edge-location",
  "global-network",
  "shared-responsibility",
  "pay-as-you-go",
  "savings",
  "elasticity",
  "high-availability",
  "fault-tolerance",
  "security",
  "compliance",
] as const;

/**
 * Base name of a 48 px icon in the official AWS Architecture Icons package (ADR-0012):
 * `Arch_…_48` for service icons, `Res_…_48` for resources that are not services (NAT Gateway,
 * ALB…). tools/icons-fetch resolves it against the downloaded package.
 */
export const ICON_NAME = /^(Arch|Res)_[A-Za-z0-9][A-Za-z0-9.-]*(_[A-Za-z0-9][A-Za-z0-9.-]*)*_48$/;

/** Fields shared by services and concepts (ADR-0027 §1). */
const entryBase = {
  id: kebabId().describe("Id estable que usan los escenarios."),
  name: text(),
  fullName: text().optional(),
  plainName: text(PLAIN_NAME_MAX_LENGTH)
    .optional()
    .describe(
      "Nombre simple para quien recién empieza (p. ej. «Almacenamiento de archivos»). Obligatorio en las entradas de escenarios de nivel 0.",
    ),
  category: kebabId().describe("Id de content/catalog/categories.yaml."),
  aliases: z.array(text()).default([]).describe("Términos para el buscador de la paleta."),
  leakPatterns: z
    .array(text())
    .min(1, { error: "La entrada necesita al menos un patrón de filtración (leakPatterns)" })
    .describe("Textos que delatan a la entrada (lint L005)."),
  short: text().describe("Descripción corta para la paleta y la explicación genérica."),
  whenToUse: text().optional(),
  whenNotToUse: text().optional(),
  docs: httpsUrl(),
  status: oneOf(SERVICE_STATUSES, "status"),
  since: positiveInt().optional().describe("Año de lanzamiento."),
};

export const ServiceSchema = z.strictObject({
  type: z.literal("service").default("service").describe("service (default) | concept."),
  ...entryBase,
  ssmNamespaces: z.array(text()).default([]),
  icon: z
    .string()
    .regex(ICON_NAME, {
      error: (iss) =>
        `${JSON.stringify(iss.input)} no es un ícono válido: usá el nombre base de un ícono de 48 px del paquete oficial, sin extensión (Arch_…_48 o Res_…_48)`,
    })
    .optional()
    .describe(
      "Nombre base del ícono de 48 px en el paquete oficial de AWS (Arch_…_48 o Res_…_48). Sin ícono, la UI muestra las iniciales sobre el color de la categoría.",
    ),
});

/**
 * An idea of the cloud that is not a service (region, shared responsibility…). Strict: an
 * `icon` or `ssmNamespaces` is an error, not silently dropped.
 */
export const ConceptSchema = z.strictObject({
  type: z.literal("concept"),
  ...entryBase,
  docs: httpsUrl().describe(
    "Fuente oficial del concepto, en docs.aws.amazon.com o aws.amazon.com (lint C012).",
  ),
  glyph: oneOf(CONCEPT_GLYPHS, "glyph")
    .optional()
    .describe("Ícono del concepto (conjunto cerrado). Sin glyph, la UI muestra las iniciales."),
});

/** Catalog entry: a service (default when `type` is missing) or a concept. */
export const CatalogEntrySchema = z.discriminatedUnion("type", [ServiceSchema, ConceptSchema], {
  error: (iss) => discriminatorMessage(iss.input, "type", "type", ENTRY_TYPES),
});

export const ServicesFileSchema = z.array(CatalogEntrySchema);

export const CategorySchema = z.strictObject({
  id: kebabId(),
  name: text(),
  kind: oneOf(CATEGORY_KINDS, "kind")
    .default("service")
    .describe("service (default) | concept: qué tipo de entrada agrupa (lint C011)."),
  adjacent: z
    .array(kebabId())
    .default([])
    .describe("Categorías adyacentes para el modo de paleta categories-plus."),
});

export const CategoriesFileSchema = z.array(CategorySchema);

export const ConfusionGroupSchema = z.strictObject({
  id: kebabId(),
  services: z
    .array(kebabId())
    .min(2, { error: "Un grupo de confusión necesita al menos dos servicios" }),
  note: text().optional(),
});

export const ConfusionGroupsFileSchema = z.array(ConfusionGroupSchema);

/** Any catalog entry (service or concept); most code only needs the shared fields. */
export type Service = z.infer<typeof CatalogEntrySchema>;
export type AwsService = z.infer<typeof ServiceSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type EntryType = (typeof ENTRY_TYPES)[number];
export type ConceptGlyph = (typeof CONCEPT_GLYPHS)[number];
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type Category = z.infer<typeof CategorySchema>;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export type ConfusionGroup = z.infer<typeof ConfusionGroupSchema>;
