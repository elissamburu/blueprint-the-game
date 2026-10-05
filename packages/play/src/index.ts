// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Light entry: the port, the adapters to the board and the pieces the app's own pages reuse
// (summary, printable version, listing). The game screen itself is the "./game-screen" subpath,
// so the app can load it (React Flow, @dnd-kit) in its own chunk (ADR-0004, RNF-03).
export type { GameBundle, GameHost } from "./host";
export type { GameScreenProps } from "./GameScreen";
export { createServiceLookup, slotViews } from "./board";
export { CaseContext, CaseObjectives } from "./CaseContent";
export { InlineMarkdown } from "./InlineMarkdown";
export { createSessionStore, useSessionStore, type SessionStoreState } from "./session-store";
export { StatusBadge } from "./StatusBadge";
export { PALETTE_COLLAPSED_KEY, readFlag, useFlagPreference, writeFlag } from "./ui-preferences";
