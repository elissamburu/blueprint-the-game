// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// «Dónde se rompe la analogía» of an answer (ADR-0027 §2, RF-STU-19): the commands that create and
// remove the whole `analogyLimit`. Its text and its references are edited with the commands of any
// other field (set, append, remove), so every operation is one splice of the YAML and one step of
// the undo history.
import type { EditCommand, EditPath } from "../../shared/document-edit";

/** Path of the `analogyLimit` of the answer at `answerPath`. */
export const analogyLimitPath = (answerPath: EditPath): EditPath => [...answerPath, "analogyLimit"];

/**
 * Creates `analogyLimit` at the end of the answer, with an empty text and one empty reference to
 * fill: the schema asks for both, and the form shows their fields right away.
 */
export const createAnalogyLimit = (answerPath: EditPath): EditCommand[] => {
  const path = analogyLimitPath(answerPath);
  return [
    { op: "set", path: [...path, "text"], value: "" },
    { op: "append", path: [...path, "references"], value: "" },
  ];
};

/** Removes the whole `analogyLimit`, with the comments above it. */
export const removeAnalogyLimit = (answerPath: EditPath): EditCommand[] => [
  { op: "remove", path: analogyLimitPath(answerPath) },
];
