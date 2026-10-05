// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Focus mode (layout v2): the board and the palette with a minimal floating bar. It asks the
// browser for full screen, but does not depend on it: if the browser refuses (no API, no
// permission, an iframe) or the player leaves full screen with Esc, focus mode goes on without
// full screen until "Salir del foco".
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};
const isFullscreen = () => (document.fullscreenElement ?? null) !== null;

const exitFullscreen = async () => {
  if (!isFullscreen() || typeof document.exitFullscreen !== "function") return;
  try {
    await document.exitFullscreen();
  } catch {
    // Already out (e.g. Esc raced us): nothing to undo.
  }
};

export interface FocusMode {
  readonly active: boolean;
  /** The browser granted full screen and it is still on. */
  readonly fullscreen: boolean;
  readonly enter: () => Promise<void>;
  readonly exit: () => Promise<void>;
}

export const useFocusMode = (): FocusMode => {
  const [active, setActive] = useState(false);
  const fullscreen = useSyncExternalStore(subscribe, isFullscreen, () => false);

  const enter = useCallback(async () => {
    setActive(true);
    // The whole document, so dialogs, menus and toasts (portals in body) are still visible.
    const root = document.documentElement;
    if (isFullscreen() || typeof root.requestFullscreen !== "function") return;
    try {
      await root.requestFullscreen();
    } catch {
      // Refused: focus mode without full screen.
    }
  }, []);

  const exit = useCallback(async () => {
    setActive(false);
    await exitFullscreen();
  }, []);

  // Leaving the game screen never leaves the browser in full screen.
  useEffect(() => () => void exitFullscreen(), []);

  return { active, fullscreen, enter, exit };
};
