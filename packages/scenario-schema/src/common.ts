// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as z from "zod";

/** kebab-case: lowercase letters and digits separated by single hyphens. */
export const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Length limits checked structurally (lint L013 in docs/03). */
export const MAX_LENGTH = {
  title: 80,
  summary: 200,
  role: 140,
  label: 40,
  rationale: 600,
} as const;

export const LEVELS = [100, 200, 300, 400] as const;

/** Palette modes a level resolves to (`auto` is resolved from the level by game-rules). */
export const CONCRETE_PALETTE_MODES = ["curated", "categories", "categories-plus", "full"] as const;

const kebabMessage = (input: unknown): string =>
  `${JSON.stringify(input)} no es un id válido: usá kebab-case (minúsculas, números y guiones, p. ej. "mi-servicio")`;

/** Id of any content entity (objective, node, edge, group, service, area, ...). */
export const kebabId = () =>
  z
    .string()
    .regex(KEBAB_CASE, { error: (iss) => kebabMessage(iss.input) })
    .describe("Identificador en kebab-case.");

/** Non-empty text, optionally capped at `max` characters. */
export const text = (max?: number) => {
  const base = z.string().trim().min(1, { error: "No puede estar vacío" });
  return max === undefined ? base : base.max(max);
};

// Schema-level messages below return `undefined` for a missing value so the per-call
// error map (errors.ts) reports it as a missing required field.

/** Absolute URL restricted to https. */
export const httpsUrl = () =>
  z.url({
    protocol: /^https$/,
    hostname: z.regexes.domain,
    error: (iss) =>
      iss.input === undefined
        ? undefined
        : `${JSON.stringify(iss.input)} no es una URL válida: tiene que empezar con https://`,
  });

export const level = () =>
  z.literal(LEVELS, {
    error: (iss) =>
      iss.input === undefined
        ? undefined
        : `El nivel ${JSON.stringify(iss.input)} no existe: tiene que ser 100, 200, 300 o 400`,
  });

export const positiveInt = () =>
  z
    .int({
      error: (iss) =>
        typeof iss.input === "number" ? "Tiene que ser un número entero" : undefined,
    })
    .positive({ error: "Tiene que ser mayor que 0" });

/** Value of the discriminator key of a union input, for messages. */
export const discriminatorOf = (input: unknown, key: string): unknown =>
  typeof input === "object" && input !== null ? (input as Record<string, unknown>)[key] : undefined;

/** Message for a union whose discriminator is missing or has an unknown value. */
export const discriminatorMessage = (
  input: unknown,
  key: string,
  field: string,
  values: readonly string[],
): string => {
  const value = discriminatorOf(input, key);
  const options = values.map((v) => `"${v}"`).join(", ");
  return value === undefined
    ? `Falta el campo obligatorio "${key}": usá ${options}`
    : `${field} ${JSON.stringify(value)} no es válido: usá ${options}`;
};

/** Closed set of string values with a readable Spanish message listing them. */
export const oneOf = <const T extends readonly [string, ...string[]]>(values: T, field: string) =>
  z.enum(values, {
    error: (iss) =>
      iss.input === undefined
        ? undefined
        : `${field} ${JSON.stringify(iss.input)} no es válido: usá ${values.map((v) => `"${v}"`).join(", ")}`,
  });
