// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// YAML editor (RF-STU-06, only YAML in this PR) with CodeMirror 6. Tab indents; Esc and then Tab
// leaves the editor (CodeMirror's tab focus mode, https://codemirror.net/examples/tab/). The
// findings of the validation are shown as diagnostics, and `focusLine` moves the cursor to a line
// and focuses the editor (the validation panel uses it). The form edits the text through `edit`:
// its commands become one transaction of the editor, so form and YAML share the undo history
// (ADR-0025 §2), and `undo`/`redo` let the form walk it.
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  redo,
  undo,
} from "@codemirror/commands";
import { yaml } from "@codemirror/lang-yaml";
import { defaultHighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type { StudioFinding } from "../../shared/validation";
import { EditError, planEdits, type EditCommand } from "../../shared/document-edit";
import {
  createEditorState,
  cursorAt,
  editorText,
  externalEdit,
  lfText,
  offsetOf,
} from "./editor-state";

export interface YamlEditorHandle {
  focusLine: (line: number, column?: number) => void;
  /**
   * Applies commands of the form as one transaction, and scrolls the YAML to the change without
   * taking the focus. `isolate`: a structural edit, its own undo step. Throws EditError when the
   * text does not parse or a path does not fit.
   */
  edit: (commands: readonly EditCommand[], isolate?: boolean) => void;
  undo: () => boolean;
  redo: () => boolean;
}

export interface YamlEditorProps {
  /** Text the editor starts with; a new value of `documentKey` loads it again. */
  initialText: string;
  documentKey: string;
  label: string;
  describedBy: string;
  findings: readonly StudioFinding[];
  onChange: (text: string) => void;
  onSave: () => void;
  ref?: Ref<YamlEditorHandle>;
}

const theme = EditorView.theme({
  "&": { height: "100%", fontSize: "0.875rem", backgroundColor: "var(--card)" },
  ".cm-scroller": {
    fontFamily: 'ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace',
    lineHeight: "1.6",
  },
  // Visible focus (docs/accesibilidad.md §2): the same ring as the rest of the UI.
  "&.cm-focused": {
    outline: "3px solid color-mix(in oklab, var(--ring) 55%, transparent)",
    outlineOffset: "-3px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--muted)",
    color: "var(--muted-foreground)",
    borderRight: "1px solid var(--border)",
  },
  ".cm-activeLine": { backgroundColor: "color-mix(in oklab, var(--accent) 45%, transparent)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--accent)", color: "var(--foreground)" },
});

const toDiagnostics = (view: EditorView, findings: readonly StudioFinding[]): Diagnostic[] =>
  findings.map((finding) => {
    const from = offsetOf(view.state, finding.line, finding.column);
    const line = view.state.doc.lineAt(from);
    return {
      from,
      to: from === line.to ? from : line.to,
      severity: finding.severity,
      source: finding.code,
      message: finding.where === "" ? finding.message : `${finding.where}: ${finding.message}`,
    };
  });

export function YamlEditor({
  initialText,
  documentKey,
  label,
  describedBy,
  findings,
  onChange,
  onSave,
  ref,
}: YamlEditorProps) {
  const parent = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The latest callbacks, without recreating the editor when they change.
  const callbacks = useRef({ onChange, onSave });
  useEffect(() => {
    callbacks.current = { onChange, onSave };
  });

  useImperativeHandle(ref, () => ({
    focusLine: (line, column = 1) => {
      const current = view.current;
      if (current === null) return;
      current.dispatch({ selection: cursorAt(current.state, line, column), scrollIntoView: true });
      current.focus();
    },
    edit: (commands, isolate = false) => {
      const current = view.current;
      if (current === null) throw new EditError("El editor no está listo");
      const { changes } = planEdits(lfText(current.state), commands);
      const spec = externalEdit(current.state, changes, isolate);
      const last = changes.at(-1);
      if (spec === undefined || last === undefined) return;
      current.dispatch({
        ...spec,
        // The last splice is already in the offsets of the final text.
        effects: EditorView.scrollIntoView(last.from, { y: "nearest" }),
      });
    },
    undo: () => (view.current === null ? false : undo(view.current)),
    redo: () => (view.current === null ? false : redo(view.current)),
  }));

  useEffect(() => {
    if (parent.current === null) return;
    const editor = new EditorView({
      parent: parent.current,
      state: createEditorState(initialText, [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        highlightActiveLine(),
        highlightSelectionMatches(),
        lintGutter(),
        yaml(),
        // Long lines wrap: an edit from the form never leaves the editor scrolled sideways.
        EditorView.lineWrapping,
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              callbacks.current.onSave();
              return true;
            },
          },
          indentWithTab,
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
        ]),
        // tabindex: the content is already in the tab order (contenteditable); saying so lets axe
        // see that its scroll container has keyboard-reachable content (scrollable-region-focusable).
        EditorView.contentAttributes.of({
          "aria-label": label,
          "aria-describedby": describedBy,
          tabindex: "0",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(editorText(update.state));
        }),
        theme,
      ]),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // The editor is created once per document; label and description do not change for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentKey]);

  useEffect(() => {
    const current = view.current;
    if (current === null) return;
    current.dispatch(setDiagnostics(current.state, toDiagnostics(current, findings)));
  }, [findings, documentKey]);

  return <div ref={parent} className="h-full min-h-[12rem] overflow-hidden rounded-md border" />;
}
