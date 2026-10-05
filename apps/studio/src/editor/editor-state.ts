// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The text of the editor round-trips byte for byte (ADR-0025 §2): CodeMirror splits lines on any
// line break, so the state keeps the separator of the file (LF or CRLF) and the text is always read
// back with it.
import { EditorSelection, EditorState, type Extension } from "@codemirror/state";

export const lineSeparatorOf = (text: string): "\r\n" | "\n" =>
  text.includes("\r\n") ? "\r\n" : "\n";

export const createEditorState = (text: string, extensions: Extension = []): EditorState =>
  EditorState.create({
    doc: text,
    extensions: [EditorState.lineSeparator.of(lineSeparatorOf(text)), extensions],
  });

/** The text as it will be saved, with the line separator of the file. */
export const editorText = (state: EditorState): string => state.sliceDoc();

/** Offset of a 1-based line and column, clamped to the document. */
export const offsetOf = (state: EditorState, line: number, column = 1): number => {
  const target = state.doc.line(Math.min(Math.max(line, 1), state.doc.lines));
  return Math.min(target.from + Math.max(column - 1, 0), target.to);
};

export const cursorAt = (state: EditorState, line: number, column = 1) =>
  EditorSelection.cursor(offsetOf(state, line, column));
