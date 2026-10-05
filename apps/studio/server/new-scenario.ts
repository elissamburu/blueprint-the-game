// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The text of a new scenario (RF-STU-01): empty, a template or a copy of another one, with the new
// id and title, `status: draft`, `version: 1` and the local git user as the only author. The
// changes are edit commands over the source text (ADR-0025 §2), so the comments and the layout of
// a template or of the duplicated scenario stay as they were.
import { parseDocument, isSeq } from "yaml";
import { planEdits, type EditCommand } from "../shared/document-edit.js";

/**
 * An empty scenario: every key the form edits, with nothing in it. It does not pass the schema
 * until the author fills it in the form, the diagram or the YAML.
 */
export const EMPTY_SCENARIO = `# SPDX-License-Identifier: CC-BY-NC-SA-4.0
# yaml-language-server: $schema=../../../packages/scenario-schema/dist/scenario.schema.json
schemaVersion: 1
id: nuevo-escenario
version: 1
status: draft
lang: es
level: 100
areas: []
title: ""
summary: ""
estimatedMinutes: 5
authors: []

context: ""

objectives: []

diagram:
  canvas: { width: 1400, height: 800 }
  groups: []
  nodes: []
  edges: []
`;

export interface NewScenario {
  id: string;
  title: string;
  /** GitHub user of the local git config; without one, `authors` stays empty. */
  author: string | undefined;
}

/**
 * The source text with the new id, title, status, version and authors. Throws EditError when the
 * source does not parse (a duplicated scenario with a YAML error).
 */
export const newScenarioText = (source: string, { id, title, author }: NewScenario): string => {
  const authors = parseDocument(source).get("authors", true);
  const count = isSeq(authors) ? authors.items.length : 0;
  const commands: EditCommand[] = [
    { op: "set", path: ["id"], value: id },
    { op: "set", path: ["title"], value: title },
    { op: "set", path: ["status"], value: "draft" },
    { op: "set", path: ["version"], value: 1 },
    // The authors of the source are not the authors of the new scenario.
    ...Array.from({ length: count }, (_, index): EditCommand => ({
      op: "remove",
      path: ["authors", count - 1 - index],
    })),
    ...(author === undefined
      ? []
      : [{ op: "append", path: ["authors"], value: { github: author } } satisfies EditCommand]),
  ];
  return planEdits(source, commands).text;
};
