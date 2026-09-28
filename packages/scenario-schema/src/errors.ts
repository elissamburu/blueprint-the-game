// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Spanish error messages applied per parse call. The package never touches Zod's global
// config, so consumers keep their own error maps.
import * as z from "zod";

const spanishLocale = z.locales.es().localeError;

type RawIssue = Parameters<z.core.$ZodErrorMap>[0];

const TYPE_NAMES: Record<string, string> = {
  string: "un texto",
  number: "un número",
  int: "un número entero",
  boolean: "true o false",
  array: "una lista",
  object: "un objeto",
};

const describeInput = (input: unknown): string => {
  if (input === null) return "null";
  if (Array.isArray(input)) return "una lista";
  switch (typeof input) {
    case "string":
      return `el texto ${JSON.stringify(input)}`;
    case "number":
      return `el número ${input}`;
    case "boolean":
      return String(input);
    case "object":
      return "un objeto";
    default:
      return typeof input;
  }
};

const lastKey = (path: readonly PropertyKey[] | undefined): string | undefined => {
  const key = path?.at(-1);
  return typeof key === "string" ? key : undefined;
};

/** Error map passed on every parse call. Schema-level messages take precedence over it. */
export const spanishErrorMap: z.core.$ZodErrorMap = (iss: RawIssue) => {
  switch (iss.code) {
    case "invalid_type": {
      const expected = TYPE_NAMES[iss.expected] ?? iss.expected;
      if (iss.input === undefined) {
        const key = lastKey(iss.path);
        return key === undefined
          ? `Falta un valor obligatorio (se esperaba ${expected})`
          : `Falta el campo obligatorio "${key}"`;
      }
      return `Se esperaba ${expected}, pero hay ${describeInput(iss.input)}`;
    }
    case "unrecognized_keys": {
      if (iss.keys.includes("violates")) {
        return '"violates" solo se permite en "incorrect": si el servicio viola un objetivo, movelo a incorrect';
      }
      if (iss.keys.includes("maxSize")) {
        return '"maxSize" solo se permite con palette.mode "auto" o "curated"';
      }
      const list = iss.keys.map((k) => `"${k}"`).join(", ");
      return iss.keys.length === 1
        ? `Campo desconocido: ${list} (¿está bien escrito?)`
        : `Campos desconocidos: ${list} (¿están bien escritos?)`;
    }
    case "too_big":
      if (iss.origin === "string") {
        const length = typeof iss.input === "string" ? ` (tiene ${iss.input.length})` : "";
        return `Puede tener como máximo ${String(iss.maximum)} caracteres${length}`;
      }
      if (iss.origin === "array") return `Puede tener como máximo ${String(iss.maximum)} elementos`;
      return `Tiene que ser como máximo ${String(iss.maximum)}`;
    case "too_small":
      if (iss.origin === "string") return "No puede estar vacío";
      if (iss.origin === "array")
        return `Tiene que tener al menos ${String(iss.minimum)} elementos`;
      return iss.inclusive === false
        ? `Tiene que ser mayor que ${String(iss.minimum)}`
        : `Tiene que ser como mínimo ${String(iss.minimum)}`;
    default:
      return spanishLocale(iss);
  }
};

export interface SchemaIssue {
  /** Path inside the parsed document, e.g. `["diagram", "nodes", 3, "answers"]`. */
  path: (string | number)[];
  /** Readable path, annotated with ids when available: `diagram.nodes[3] (upload-store).answers`. */
  where: string;
  message: string;
}

const idOf = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const { id } = value;
  return typeof id === "string" ? id : undefined;
};

const describePath = (input: unknown, path: readonly (string | number)[]): string => {
  let where = "";
  let current: unknown = input;
  for (const key of path) {
    where += typeof key === "number" ? `[${key}]` : where === "" ? key : `.${key}`;
    current =
      typeof current === "object" && current !== null
        ? (current as Record<string | number, unknown>)[key]
        : undefined;
    const id = typeof key === "number" ? idOf(current) : undefined;
    if (id !== undefined) where += ` (${id})`;
  }
  return where === "" ? "(raíz)" : where;
};

export const toSchemaIssues = (error: z.ZodError, input: unknown): SchemaIssue[] =>
  error.issues.map((issue) => {
    const path = issue.path.map((key) => (typeof key === "symbol" ? String(key) : key));
    return { path, where: describePath(input, path), message: issue.message };
  });

/** One issue per line: `where: message`. */
export const formatIssues = (issues: readonly SchemaIssue[]): string =>
  issues.map((issue) => `${issue.where}: ${issue.message}`).join("\n");
