// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Local copy of the unsaved text of the editor, so a closed tab, a reload or a crash does not lose
// the work: in the browser's localStorage, one entry per scenario id, never sent to the server.
// Storage may be missing or full (private mode, quota, blocked site data): every access is in a
// try/catch and the editor works the same without it.
import * as z from "zod";

export const AUTOSAVE_DELAY_MS = 1000;
const KEY_PREFIX = "blueprint-studio:draft:";

const LocalDraftSchema = z.strictObject({
  /** The text of the editor, with the line separator of the file. */
  text: z.string(),
  /** Hash of the file the text was based on: when it differs, the file changed on disk since. */
  baseHash: z.string(),
});
export type LocalDraft = z.infer<typeof LocalDraftSchema>;

const defaultStorage = (): Storage | undefined => {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
};

export const readLocalDraft = (
  id: string,
  storage: () => Storage | undefined = defaultStorage,
): LocalDraft | undefined => {
  try {
    const stored = storage()?.getItem(KEY_PREFIX + id);
    if (stored === null || stored === undefined) return undefined;
    const draft = LocalDraftSchema.safeParse(JSON.parse(stored));
    return draft.success ? draft.data : undefined;
  } catch {
    return undefined;
  }
};

export const writeLocalDraft = (
  id: string,
  draft: LocalDraft,
  storage: () => Storage | undefined = defaultStorage,
): void => {
  try {
    storage()?.setItem(KEY_PREFIX + id, JSON.stringify(draft));
  } catch {
    // Without storage (or over its quota) there is no local copy; saving still works.
  }
};

export const clearLocalDraft = (
  id: string,
  storage: () => Storage | undefined = defaultStorage,
): void => {
  try {
    storage()?.removeItem(KEY_PREFIX + id);
  } catch {
    // Nothing to clear.
  }
};
