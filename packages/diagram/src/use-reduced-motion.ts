// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
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
