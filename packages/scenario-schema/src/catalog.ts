// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Structural schemas of content/catalog/*.yaml (docs/03 §4–§5, RF-CAT-01..03).
import * as z from "zod";
import { httpsUrl, kebabId, oneOf, positiveInt, text } from "./common.js";

export const SERVICE_STATUSES = ["active", "deprecated"] as const;

/**
 * Base name of a 48 px icon in the official AWS Architecture Icons package (ADR-0012):
 * `Arch_…_48` for service icons, `Res_…_48` for resources that are not services (NAT Gateway,
 * ALB…). tools/icons-fetch resolves it against the downloaded package.
 */
export const ICON_NAME = /^(Arch|Res)_[A-Za-z0-9][A-Za-z0-9.-]*(_[A-Za-z0-9][A-Za-z0-9.-]*)*_48$/;

export const ServiceSchema = z.strictObject({
  id: kebabId().describe("Id estable que usan los escenarios."),
  name: text(),
  fullName: text().optional(),
  category: kebabId().describe("Id de content/catalog/categories.yaml."),
  aliases: z.array(text()).default([]).describe("Términos para el buscador de la paleta."),
  leakPatterns: z
    .array(text())
    .min(1, { error: "El servicio necesita al menos un patrón de filtración (leakPatterns)" })
    .describe("Textos que delatan al servicio (lint L005)."),
  short: text().describe("Descripción corta para la paleta y la explicación genérica."),
  whenToUse: text().optional(),
  whenNotToUse: text().optional(),
  docs: httpsUrl(),
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
  status: oneOf(SERVICE_STATUSES, "status"),
  since: positiveInt().optional().describe("Año de lanzamiento."),
});

export const ServicesFileSchema = z.array(ServiceSchema);

export const CategorySchema = z.strictObject({
  id: kebabId(),
  name: text(),
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

export type Service = z.infer<typeof ServiceSchema>;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];
export type Category = z.infer<typeof CategorySchema>;
export type ConfusionGroup = z.infer<typeof ConfusionGroupSchema>;
