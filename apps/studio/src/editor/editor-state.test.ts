// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Opening a scenario in the editor and reading its text back gives the same bytes (ADR-0025 §2),
// for the 8 scenarios of content/ (Vite ?raw, no fs), with LF, CRLF and a BOM.
import { describe, expect, it } from "vitest";
import { createEditorState, editorText, lineSeparatorOf, offsetOf } from "./editor-state";

const scenarios = import.meta.glob<string>("../../../../content/scenarios/*/scenario.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
});
const real = Object.entries(scenarios).filter(([file]) => !file.includes("/_"));

describe("editor state", () => {
  it("covers the 8 scenarios of content/", () => {
    expect(real).toHaveLength(8);
  });

  it.each(real)("round-trips %s byte for byte", (_file, text) => {
    expect(editorText(createEditorState(text))).toBe(text);
    const crlf = text.replaceAll("\n", "\r\n");
    expect(editorText(createEditorState(crlf))).toBe(crlf);
    const bom = `${String.fromCharCode(0xfeff)}${text}`;
    expect(editorText(createEditorState(bom))).toBe(bom);
  });

  it("keeps the separator of the file for new lines", () => {
    const state = createEditorState("a: 1\r\nb: 2\r\n");
    const next = state.update({
      changes: { from: state.doc.length, insert: `c: 3${state.lineBreak}` },
    }).state;
    expect(editorText(next)).toBe("a: 1\r\nb: 2\r\nc: 3\r\n");
    expect(lineSeparatorOf("a\nb")).toBe("\n");
  });

  it("maps a line and column to an offset, clamped to the document", () => {
    const state = createEditorState("ab\ncde\n");
    expect(offsetOf(state, 2, 2)).toBe(4);
    expect(offsetOf(state, 2, 99)).toBe(6);
    expect(offsetOf(state, 99)).toBe(7);
    expect(offsetOf(state, 0)).toBe(0);
  });
});
