// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// prefers-reduced-motion of the system (docs/accesibilidad.md §3), for the components that pick a
// motion in JS: the board (flow player, slots), the feedback card and the summary.
import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

const media = (): MediaQueryList | null =>
  typeof window === "undefined" || typeof window.matchMedia !== "function"
    ? null
    : window.matchMedia(QUERY);

const subscribe = (onChange: () => void) => {
  const list = media();
  list?.addEventListener("change", onChange);
  return () => list?.removeEventListener("change", onChange);
};

/** The user asked the system for reduced motion. Follows changes while the page is open. */
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => media()?.matches ?? false,
    () => false,
  );
