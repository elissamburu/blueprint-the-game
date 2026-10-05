// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Visual editor of the diagram, for the Studio only (RF-STU-04): a subpath of its own, so the game
// never loads it.
export {
  DiagramEditor,
  EDITOR_HELP,
  PALETTE_DRAG_TYPE,
  type DiagramEditorHandle,
  type DiagramEditorProps,
} from "./DiagramEditor";
export {
  GRID,
  GROUP_KIND_NAMES,
  NODE_TYPE_NAMES,
  NUDGE,
  sameSelection,
  selectionKey,
  type DiagramCommand,
  type DiagramSelection,
  type ElementKind,
  type Placement,
  type StepDirection,
} from "./editor-model";
export { groupTitle, nodeNames, type ElementIssues, type IssueLevel } from "./editor-flow";
