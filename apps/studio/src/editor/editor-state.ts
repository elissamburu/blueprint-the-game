// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The text of the editor round-trips byte for byte (ADR-0025 §2): CodeMirror splits lines on any
// line break, so the state keeps the separator of the file (LF or CRLF) and the text is always read
// back with it.
import { isolateHistory } from "@codemirror/commands";
import {
  ChangeSet,
  EditorSelection,
  EditorState,
  type Extension,
  type TransactionSpec,
} from "@codemirror/state";

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

/** A splice of the text, in the offsets of the text with LF line breaks (the editor's). */
export interface TextSplice {
  from: number;
  to: number;
  insert: string;
}

/**
 * The transaction of an edit made outside the editor (the form): the splices, each one over the
 * text left by the previous one, composed into one change. It goes into the history of the editor,
 * so there is a single undo stack for the form and the YAML. Typing in a field of the form
 * joins the history event of the previous keystroke, as typing in the editor does; a structural
 * edit (`isolate`: add, remove or move) is always an event of its own.
 */
export const externalEdit = (
  state: EditorState,
  splices: readonly TextSplice[],
  isolate: boolean,
): TransactionSpec | undefined => {
  const [first, ...rest] = splices;
  if (first === undefined) return undefined;
  let changes = ChangeSet.of(first, state.doc.length);
  for (const splice of rest) changes = changes.compose(ChangeSet.of(splice, changes.newLength));
  return {
    changes,
    userEvent: "input.form",
    ...(isolate ? { annotations: isolateHistory.of("full") } : {}),
  };
};

/** The text with LF line breaks, whose offsets are the editor's (what the form edits). */
export const lfText = (state: EditorState): string => state.doc.toString();
