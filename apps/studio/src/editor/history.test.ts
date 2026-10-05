// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// One undo stack for the form and the YAML (ADR-0025 §2): an edit of the form is a transaction of
// the editor, so undo and redo walk the edits in order, wherever they were made.
import { history, redo, undo } from "@codemirror/commands";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { planEdits, type EditCommand } from "../form/document-edit";
import { createEditorState, editorText, externalEdit, lfText } from "./editor-state";

const TEXT = '# encabezado\r\ntitle: "Hola"\r\nobjectives:\r\n  - id: a\r\n    text: "A"\r\n';

/** A state with the history, and a way to run transactions and commands on it. */
const session = (text: string) => {
  let state: EditorState = createEditorState(text, history());
  const dispatch = (spec: TransactionSpec) => {
    state = state.update(spec).state;
  };
  return {
    get text() {
      return editorText(state);
    },
    form: (commands: EditCommand[], isolate = false) => {
      const spec = externalEdit(state, planEdits(lfText(state), commands).changes, isolate);
      if (spec !== undefined) dispatch(spec);
    },
    type: (at: number, insert: string) =>
      dispatch({ changes: { from: at, insert }, userEvent: "input.type" }),
    undo: () => undo({ state, dispatch: (tr) => (state = tr.state) }),
    redo: () => redo({ state, dispatch: (tr) => (state = tr.state) }),
  };
};

describe("one history for the form and the YAML", () => {
  it("undoes and redoes form and YAML edits in order, keeping CRLF", () => {
    const editor = session(TEXT);
    editor.form([{ op: "set", path: ["title"], value: "Hola mundo" }]);
    expect(editor.text).toBe(TEXT.replace('"Hola"', '"Hola mundo"'));
    editor.type(0, "# arriba\r\n");
    editor.form([{ op: "append", path: ["objectives"], value: { id: "b", text: "B" } }], true);
    expect(editor.text).toContain('  - id: b\r\n    text: "B"');
    const last = editor.text;

    expect(editor.undo()).toBe(true);
    expect(editor.text).toBe(`# arriba\r\n${TEXT.replace('"Hola"', '"Hola mundo"')}`);
    expect(editor.undo()).toBe(true);
    expect(editor.text).toBe(TEXT.replace('"Hola"', '"Hola mundo"'));
    expect(editor.undo()).toBe(true);
    expect(editor.text).toBe(TEXT);

    editor.redo();
    editor.redo();
    editor.redo();
    expect(editor.text).toBe(last);
  });

  it("composes the changes of several commands into one undo step", () => {
    const editor = session("a: 1\nb: 2\n");
    editor.form(
      [
        { op: "set", path: ["a"], value: 2 },
        { op: "set", path: ["b"], value: 1 },
      ],
      true,
    );
    expect(editor.text).toBe("a: 2\nb: 1\n");
    editor.undo();
    expect(editor.text).toBe("a: 1\nb: 2\n");
  });

  it("does nothing for an edit without changes", () => {
    const state = createEditorState("a: 1\n");
    expect(externalEdit(state, [], false)).toBeUndefined();
  });
});
