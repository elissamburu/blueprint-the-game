// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Interface preferences of this browser (e.g. the palette collapsed; the app keeps its own, such
// as the dismissed notices, with the same helpers). They are not progress: they
// live in their own localStorage key, outside the progress schema, and losing them only resets
// the look. Storage may be blocked, so every access is guarded.
import { useCallback, useState } from "react";

export const PALETTE_COLLAPSED_KEY = "blueprint.ui.paletteCollapsed";

const storage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const readFlag = (key: string): boolean => {
  try {
    return storage()?.getItem(key) === "true";
  } catch {
    return false;
  }
};

export const writeFlag = (key: string, value: boolean): void => {
  try {
    if (value) storage()?.setItem(key, "true");
    else storage()?.removeItem(key);
  } catch {
    // Blocked or full storage: the preference only lasts for this visit.
  }
};

/** A boolean preference remembered in this browser. */
export const useFlagPreference = (key: string): [boolean, (value: boolean) => void] => {
  const [value, setValue] = useState(() => readFlag(key));
  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      writeFlag(key, next);
    },
    [key],
  );
  return [value, update];
};
