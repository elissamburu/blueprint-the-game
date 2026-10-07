// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// «Dónde se rompe la analogía» edits the nested `analogyLimit` with minimal splices (ADR-0025 §2,
// RF-STU-19): creating it, editing its text, adding, editing and removing references, and removing
// it whole change only its lines, keep the comments, the order of the keys and CRLF, and each one is
// one step of the single undo history.
import { history, undo } from "@codemirror/commands";
import type { EditorState, TransactionSpec } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { parseDocument } from "yaml";
import { planEdits, type EditCommand } from "../../shared/document-edit";
import { createEditorState, editorText, externalEdit, lfText } from "../editor/editor-state";
import { analogyLimitPath, createAnalogyLimit, removeAnalogyLimit } from "./analogy-limit";

const ANSWER = ["diagram", "nodes", 0, "answers", 0] as const;
const LIMIT = analogyLimitPath(ANSWER);

const WITH_COMMENTS = `# encabezado
diagram:
  nodes:
    - id: city
      type: slot
      answers:
        # la respuesta óptima
        - service: region
          grade: optimal
          objectives: [near]   # el objetivo
          rationale: "Como la ciudad."
          references:
            - https://docs.aws.amazon.com/a
        - service: s3
          grade: acceptable
          objectives: [near]
          rationale: "Otra."
      incorrect: []   # sin incorrectos
`;

const CREATED = `          analogyLimit:
            text: ""
            references:
              - ""
`;

const edit = (text: string, commands: readonly EditCommand[]): string =>
  planEdits(text, commands).text;
const keysOf = (text: string, path: readonly (string | number)[]): string[] =>
  Object.keys(
    path.reduce<unknown>(
      (value, key) => (value as Record<string | number, unknown>)[key],
      parseDocument(text).toJS(),
    ) as object,
  );

describe("analogyLimit edits", () => {
  it("creates it at the end of the answer, changing only its own lines", () => {
    const after = edit(WITH_COMMENTS, createAnalogyLimit(ANSWER));
    expect(after).toBe(
      WITH_COMMENTS.replace(
        "            - https://docs.aws.amazon.com/a\n",
        `            - https://docs.aws.amazon.com/a\n${CREATED}`,
      ),
    );
    expect(keysOf(after, ANSWER)).toEqual([
      "service",
      "grade",
      "objectives",
      "rationale",
      "references",
      "analogyLimit",
    ]);
  });

  it("edits the text and adds, edits and removes references, then removes it whole", () => {
    const created = edit(WITH_COMMENTS, createAnalogyLimit(ANSWER));
    const text = edit(created, [
      { op: "set", path: [...LIMIT, "text"], value: "Una ciudad es un solo lugar." },
    ]);
    expect(text).toBe(created.replace('text: ""', 'text: "Una ciudad es un solo lugar."'));

    const first = edit(text, [
      { op: "set", path: [...LIMIT, "references", 0], value: "https://docs.aws.amazon.com/b" },
    ]);
    // An item created empty keeps its double quotes, as the references of an answer do.
    expect(first).toBe(text.replace('- ""', '- "https://docs.aws.amazon.com/b"'));

    const added = edit(first, [
      { op: "append", path: [...LIMIT, "references"], value: "https://aws.amazon.com/c" },
    ]);
    expect(added).toBe(
      first.replace(
        '              - "https://docs.aws.amazon.com/b"\n',
        '              - "https://docs.aws.amazon.com/b"\n              - https://aws.amazon.com/c\n',
      ),
    );

    const removedReference = edit(added, [{ op: "remove", path: [...LIMIT, "references", 0] }]);
    expect(removedReference).toBe(
      added.replace('              - "https://docs.aws.amazon.com/b"\n', ""),
    );

    // Emptying the text writes "" and keeps the key: only «Quitar» removes it.
    const emptied = edit(removedReference, [{ op: "set", path: [...LIMIT, "text"], value: "" }]);
    expect(parseDocument(emptied).getIn([...LIMIT, "text"])).toBe("");

    expect(edit(emptied, removeAnalogyLimit(ANSWER))).toBe(WITH_COMMENTS);
  });

  it("keeps the comments of an existing one, and removing it takes only its own", () => {
    const text = WITH_COMMENTS.replace(
      "            - https://docs.aws.amazon.com/a\n",
      `            - https://docs.aws.amazon.com/a
          # dónde se rompe
          analogyLimit:
            # el texto
            text: >
              Una ciudad es un solo lugar; una región tiene
              varias zonas.
            references:
              - https://docs.aws.amazon.com/b   # la oficial
`,
    );
    const edited = edit(text, [{ op: "set", path: [...LIMIT, "text"], value: "Otro texto.\n" }]);
    expect(edited).toBe(
      text.replace(
        "              Una ciudad es un solo lugar; una región tiene\n              varias zonas.\n",
        "              Otro texto.\n",
      ),
    );
    const reference = edit(edited, [
      { op: "set", path: [...LIMIT, "references", 0], value: "https://aws.amazon.com/c" },
    ]);
    expect(reference).toBe(
      edited.replace(
        "https://docs.aws.amazon.com/b   # la oficial",
        "https://aws.amazon.com/c   # la oficial",
      ),
    );
    expect(edit(reference, removeAnalogyLimit(ANSWER))).toBe(WITH_COMMENTS);
  });

  it("works on a CRLF file: every operation keeps CRLF and is one undo step", () => {
    const crlf = WITH_COMMENTS.replaceAll("\n", "\r\n");
    let state: EditorState = createEditorState(crlf, history());
    const dispatch = (spec: TransactionSpec) => {
      state = state.update(spec).state;
    };
    const steps: string[] = [editorText(state)];
    const run = (commands: readonly EditCommand[]) => {
      const spec = externalEdit(state, planEdits(lfText(state), commands).changes, true);
      if (spec === undefined) throw new Error("no change");
      dispatch(spec);
      steps.push(editorText(state));
    };

    run(createAnalogyLimit(ANSWER));
    run([{ op: "set", path: [...LIMIT, "text"], value: "Una ciudad es un solo lugar." }]);
    run([{ op: "set", path: [...LIMIT, "references", 0], value: "https://docs.aws.amazon.com/b" }]);
    run([{ op: "append", path: [...LIMIT, "references"], value: "https://aws.amazon.com/c" }]);
    run([{ op: "remove", path: [...LIMIT, "references", 0] }]);
    run(removeAnalogyLimit(ANSWER));

    for (const step of steps) expect(step.replaceAll("\r\n", "")).not.toContain("\n");
    expect(steps[1]).toBe(edit(WITH_COMMENTS, createAnalogyLimit(ANSWER)).replaceAll("\n", "\r\n"));
    expect(steps[4]).toContain(
      '              - "https://docs.aws.amazon.com/b"\r\n              - https://aws.amazon.com/c\r\n',
    );
    expect(editorText(state)).toBe(crlf);

    // Undo walks back one operation at a time.
    for (let index = steps.length - 2; index >= 0; index--) {
      undo({ state, dispatch: (transaction) => (state = transaction.state) });
      expect(editorText(state)).toBe(steps[index]);
    }
  });
});
