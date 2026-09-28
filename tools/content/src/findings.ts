// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Issue, IssuePath, Severity } from "@blueprint/content-lint";
import type { SchemaIssue } from "@blueprint/scenario-schema";

/**
 * A problem found in a content file. Lint rules keep their code (L001…L019, C001…C010); problems found
 * by the CLI itself use FILE (missing file), YAML (syntax), SCHEMA (structure) and GIT.
 */
export interface Finding {
  code: string;
  severity: Severity;
  message: string;
  /** Path relative to the parent of the content dir, with `/`: `content/catalog/services.yaml`. */
  file: string;
  /** Readable location inside the document: `diagram.nodes[3] (upload-store).role`. */
  where?: string;
}

export const countBySeverity = (
  findings: readonly Finding[],
): { errors: number; warnings: number } => ({
  errors: findings.filter((f) => f.severity === "error").length,
  warnings: findings.filter((f) => f.severity === "warning").length,
});

export const fromSchemaIssues = (file: string, issues: readonly SchemaIssue[]): Finding[] =>
  issues.map((issue) => ({
    code: "SCHEMA",
    severity: "error",
    message: issue.message,
    file,
    where: issue.where,
  }));

const idOf = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const { id } = value;
  return typeof id === "string" ? id : undefined;
};

/** `["diagram", "nodes", 3, "role"]` → `diagram.nodes[3] (upload-store).role`. */
export const describePath = (document: unknown, path: IssuePath): string => {
  let where = "";
  let current: unknown = document;
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

export const fromLintIssue = (file: string, document: unknown, issue: Issue): Finding => ({
  code: issue.code,
  severity: issue.severity,
  message: issue.message,
  file,
  where: describePath(document, issue.path),
});
