// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Ordenar" (RF-STU-05) as edits of the text, on every scenario of content/: the result has no
// L007 errors, nothing changes but position, rect and canvas, a second "Ordenar" has nothing left
// to do, and one undo gives the text back byte for byte (also with CRLF).
import { autoLayout } from "@blueprint/diagram/layout";
import { parseDiagramDraft } from "@blueprint/scenario-schema";
import { history, undo } from "@codemirror/commands";
import type { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { validateScenarioText } from "../../shared/validation";
import { createEditorState, editorText, externalEdit, lfText } from "../editor/editor-state";
import { planEdits } from "../../shared/document-edit";
import { recordOf } from "../form/form-data";
import { shared } from "../testing/content-fixture";
import { layoutCommands } from "./diagram-commands";

const sources = import.meta.glob("../../../../content/scenarios/*/scenario.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});
const scenarios: [string, string][] = Object.entries(sources).map(([path, text]) => [
  path.split("/").at(-2) ?? path,
  text,
]);

/** "Ordenar" over a text: the commands and the counts. */
const layoutOf = async (text: string) => {
  const raw: unknown = parseYaml(text);
  const draft = parseDiagramDraft(recordOf(raw).diagram);
  return layoutCommands(raw, await autoLayout(draft));
};

/** The scenario without the geometry "Ordenar" may change. */
const withoutGeometry = (text: string): unknown =>
  JSON.parse(JSON.stringify(parseYaml(text)), (key, value: unknown) =>
    key === "position" || key === "rect" || key === "canvas" ? undefined : value,
  );

describe("Ordenar on every scenario of content/", () => {
  it("finds the scenarios", () => {
    expect(scenarios.length).toBeGreaterThanOrEqual(8);
  });

  it.each(scenarios)("%s: no L007 errors and only geometry changes", async (id, text) => {
    const { commands } = await layoutOf(text);
    const laidOut = planEdits(text, commands).text;

    const { findings, stage } = validateScenarioText(laidOut, id, shared);
    expect(stage).toBe("lint");
    expect(findings.filter((f) => f.code === "L007" && f.severity === "error")).toEqual([]);
    // No finding appears that was not there before (an L007 warning neither).
    const before = new Set(
      validateScenarioText(text, id, shared).findings.map((f) => `${f.code} ${f.message}`),
    );
    expect(findings.map((f) => `${f.code} ${f.message}`).filter((f) => !before.has(f))).toEqual([]);

    expect(withoutGeometry(laidOut)).toEqual(withoutGeometry(text));
    for (const command of commands) {
      expect(command.op).toBe("set");
      expect(command.path).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(position|rect|canvas)$/)]),
      );
    }
    // A second "Ordenar" has nothing left to do ("Ya está ordenado").
    expect((await layoutOf(laidOut)).commands).toEqual([]);
  });

  it.each(scenarios)("%s: one undo gives the text back byte for byte", async (_, lf) => {
    for (const text of [lf, lf.replace(/\n/g, "\r\n")]) {
      let state: EditorState = createEditorState(text, history());
      const { commands } = await layoutOf(text);
      expect(commands.length).toBeGreaterThan(0);
      const spec = externalEdit(state, planEdits(lfText(state), commands).changes, true);
      if (spec === undefined) throw new Error("no edit");
      state = state.update(spec).state;
      expect(editorText(state)).not.toBe(text);
      undo({ state, dispatch: (transaction) => (state = transaction.state) });
      expect(editorText(state)).toBe(text);
    }
  });
});

describe("layoutCommands", () => {
  const raw = {
    diagram: {
      canvas: { width: 100, height: 100 },
      groups: [{ id: "g", rect: { x: 1, y: 2, w: 3, h: 4 } }],
      nodes: [
        { id: "a", type: "actor", position: { x: 40, y: 40 } },
        { id: "b", type: "actor", position: { x: 0, y: 0 } },
        { id: "a", type: "actor", position: { x: 0, y: 0 } },
      ],
    },
  };

  it("sets only what changes, the first element of each id, and counts what moved", () => {
    const result = {
      positions: new Map([
        ["a", { x: 40, y: 40 }],
        ["b", { x: 200, y: 0 }],
      ]),
      rects: new Map([["g", { x: 1, y: 2, w: 30, h: 4 }]]),
      canvas: { width: 100, height: 300 },
    };
    expect(layoutCommands(raw, result)).toEqual({
      commands: [
        { op: "set", path: ["diagram", "nodes", 1, "position", "x"], value: 200 },
        { op: "set", path: ["diagram", "groups", 0, "rect", "w"], value: 30 },
        { op: "set", path: ["diagram", "canvas", "height"], value: 300 },
      ],
      nodes: 1,
      groups: 1,
    });
  });
});
