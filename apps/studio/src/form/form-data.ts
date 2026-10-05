// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The form reads the document as plain data (`Document.toJS()`), which may not pass the schema
// (ADR-0025 §2: the form stays editable by path). These readers never trust its shape.
import { useState } from "react";
import { parseDocument } from "yaml";
import type { EditPath } from "../../shared/document-edit";

export type RawRecord = Readonly<Record<string, unknown>>;

export const isRecord = (value: unknown): value is RawRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);

export const recordOf = (value: unknown): RawRecord => (isRecord(value) ? value : {});

/** The value at `path`, or `undefined`. */
export const valueAt = (raw: unknown, path: EditPath): unknown => {
  let current = raw;
  for (const key of path) {
    if (typeof key === "number") current = listOf(current)[key];
    else current = recordOf(current)[key];
    if (current === undefined) return undefined;
  }
  return current;
};

/** A scalar as the text of a field: strings as they are, numbers and booleans written out. */
export const textOf = (value: unknown): string =>
  typeof value === "string"
    ? value
    : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : "";

/** `base`, or `base-2`, `base-3`… the first that is not in `taken`. */
export const uniqueId = (base: string, taken: readonly unknown[]): string => {
  const used = new Set(taken.map(textOf));
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
};

export interface FormDocument {
  /** The data of the last text that parsed. */
  raw: unknown;
  /** Line of the first syntax error of the current text: the form is read-only. */
  errorLine?: number;
}

const parseRaw = (text: string): { raw: unknown } | { errorLine: number } => {
  const document = parseDocument(text);
  const [error] = document.errors;
  if (error !== undefined) return { errorLine: error.linePos?.[0].line ?? 1 };
  return { raw: document.toJS() };
};

/**
 * The data of the form for the editor's text. While the text does not parse, the last data that
 * did, with the line of the error (the form shows it read-only).
 */
export const useFormDocument = (text: string): FormDocument => {
  const [state, setState] = useState<{ text: string; document: FormDocument } | undefined>();
  if (state !== undefined && state.text === text) return state.document;
  const parsed = parseRaw(text);
  const document: FormDocument =
    "raw" in parsed
      ? { raw: parsed.raw }
      : { raw: state?.document.raw, errorLine: parsed.errorLine };
  // State derived from props, updated during render (as useDraft).
  setState({ text, document });
  return document;
};
