// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "./use-presence";

afterEach(() => vi.useRealTimers());

describe("usePresence", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const start: { value: typeof a | null } = { value: a };

  it("keeps the last value while it leaves, until its exit ends", () => {
    const { result, rerender } = renderHook(({ value }) => usePresence(value, 300), {
      initialProps: start,
    });
    expect(result.current).toMatchObject({ shown: a, leaving: false });
    rerender({ value: null });
    expect(result.current).toMatchObject({ shown: a, leaving: true });
    act(() => result.current.exited());
    expect(result.current).toMatchObject({ shown: null, leaving: false });
  });

  it("drops it after exitMs if the end is never heard, and comes back with a new value", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ value }) => usePresence(value, 300), {
      initialProps: start,
    });
    rerender({ value: null });
    rerender({ value: b });
    expect(result.current).toMatchObject({ shown: b, leaving: false });
    rerender({ value: null });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.shown).toBeNull();
  });
});
