// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Keeps an element on screen while it leaves (RF-PLAY-17): when `value` turns null, the last one
// is still shown, `leaving`, until its exit animation ends (`exited`) or, if that end is never
// heard, after `exitMs`. A new value while it leaves brings it back.
import { useEffect, useState } from "react";

export interface Presence<T> {
  /** What to render: the value, or the last one while it leaves. */
  shown: T | null;
  leaving: boolean;
  /** The exit animation ended: the element goes away. */
  exited: () => void;
}

/** `value` has to keep its identity while it does not change (useMemo): it is compared by it. */
export function usePresence<T>(value: T | null, exitMs: number): Presence<T> {
  const [last, setLast] = useState<T | null>(value);
  // Updated while rendering (react.dev, "Storing information from previous renders").
  if (value !== null && value !== last) setLast(value);
  const leaving = value === null && last !== null;

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLast(null), exitMs);
    return () => window.clearTimeout(timer);
  }, [leaving, exitMs]);

  return { shown: value ?? last, leaving, exited: () => setLast(null) };
}
