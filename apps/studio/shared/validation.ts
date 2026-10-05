// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Validation of a scenario.yaml text (RF-STU-07, ADR-0025 §2): YAML syntax, scenario-schema and
// content-lint, the same checks and messages as pnpm content:validate for one scenario, plus the
// line of scenario.yaml each finding points to. Pure: the UI runs it on every edit and the server
// before writing (S10). L012 and L014 do not run here: saving regenerates the generated files, and
// L014 stays in content:validate --base and CI.
import { lintScenario, type IssuePath, type Severity } from "@blueprint/content-lint";
import { parseScenario, type Scenario } from "@blueprint/scenario-schema";
import { isMap, isScalar, isSeq, LineCounter, parseDocument, type Document } from "yaml";
import type { SharedContent } from "./api.js";

export interface StudioFinding {
  /** `YAML` (syntax), `SCHEMA` (structure) or the lint rule (`L005`, …), as in content:validate. */
  code: string;
  severity: Severity;
  message: string;
  /** Readable path inside the document, as content:validate prints it; empty for YAML errors. */
  where: string;
  /** Path of the issue in the document (the field of the form it belongs to); empty for YAML. */
  path: IssuePath;
  /** 1-based line and column of scenario.yaml. */
  line: number;
  column: number;
}

export interface ScenarioValidation {
  /** In the order content:validate reports them. */
  findings: StudioFinding[];
  /** Furthest step reached: `yaml` (does not parse), `schema` (fails the schema) or `lint`. */
  stage: "yaml" | "schema" | "lint";
  /** The parsed scenario, when the text passes the schema. */
  scenario?: Scenario;
}

const idOf = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const { id } = value;
  return typeof id === "string" ? id : undefined;
};

/** `["diagram", "nodes", 3, "role"]` → `diagram.nodes[3] (upload-store).role`, as content:validate. */
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

const startOf = (node: unknown): number | undefined => {
  if (typeof node !== "object" || node === null || !("range" in node)) return undefined;
  const { range } = node as { range?: readonly number[] | null };
  return range?.[0];
};

/**
 * Offset of the deepest node of `path` that exists in the document: the key of a mapping entry
 * (so `role:` points to its line even when the value is missing) or the item of a sequence. A path
 * that leaves the document stops at its last existing ancestor.
 */
export const offsetOfPath = (document: Document, path: IssuePath): number => {
  let node: unknown = document.contents;
  let offset = startOf(node) ?? 0;
  for (const key of path) {
    if (isMap(node)) {
      const pair = node.items.find(
        (item) => isScalar(item.key) && String(item.key.value) === String(key),
      );
      if (pair === undefined) break;
      offset = startOf(pair.key) ?? offset;
      node = pair.value;
    } else if (isSeq(node) && typeof key === "number") {
      const item: unknown = node.items[key];
      if (item === undefined) break;
      offset = startOf(item) ?? offset;
      node = item;
    } else {
      break;
    }
  }
  return offset;
};

export const validateScenarioText = (
  text: string,
  folderName: string,
  shared: SharedContent,
): ScenarioValidation => {
  const lineCounter = new LineCounter();
  const document = parseDocument(text, { prettyErrors: true, lineCounter });
  const position = (offset: number) => {
    const { line, col } = lineCounter.linePos(offset);
    return { line, column: col };
  };

  if (document.errors.length > 0) {
    return {
      stage: "yaml",
      findings: document.errors.map((error) => ({
        code: "YAML",
        severity: "error",
        message: `YAML inválido: ${(error.message.split("\n")[0] ?? "").replace(/:$/, "")}`,
        where: "",
        path: [],
        ...(error.linePos === undefined
          ? position(error.pos[0])
          : { line: error.linePos[0].line, column: error.linePos[0].col }),
      })),
    };
  }

  const raw: unknown = document.toJS();
  const parsed = parseScenario(raw);
  if (!parsed.success) {
    return {
      stage: "schema",
      findings: parsed.issues.map((issue) => ({
        code: "SCHEMA",
        severity: "error",
        message: issue.message,
        where: issue.where,
        path: issue.path,
        ...position(offsetOfPath(document, issue.path)),
      })),
    };
  }

  const issues = lintScenario({
    scenario: parsed.data,
    folderName,
    catalog: shared.catalog,
    confusionGroups: shared.confusionGroups,
    gameRules: shared.gameRules,
    areas: shared.areas,
  });
  return {
    stage: "lint",
    scenario: parsed.data,
    findings: issues.map((issue) => ({
      code: issue.code,
      severity: issue.severity,
      message: issue.message,
      where: describePath(raw, issue.path),
      path: issue.path,
      ...position(offsetOfPath(document, issue.path)),
    })),
  };
};

/** Counts for the summary of the validation panel. */
export const countFindings = (
  findings: readonly StudioFinding[],
): { errors: number; warnings: number } => ({
  errors: findings.filter((finding) => finding.severity === "error").length,
  warnings: findings.filter((finding) => finding.severity === "warning").length,
});
