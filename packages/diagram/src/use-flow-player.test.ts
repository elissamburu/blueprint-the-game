// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STEP_DURATION_MS, useFlowPlayer } from "./use-flow-player";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useFlowPlayer", () => {
  it("walks the steps on its own and stops on the last one", () => {
    const { result } = renderHook(() => useFlowPlayer(3, true));
    act(() => result.current.start());
    expect(result.current).toMatchObject({ current: 0, playing: true });
    act(() => {
      vi.advanceTimersByTime(STEP_DURATION_MS);
    });
    expect(result.current.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(STEP_DURATION_MS);
    });
    expect(result.current).toMatchObject({ current: 2, playing: true });
    act(() => {
      vi.advanceTimersByTime(STEP_DURATION_MS);
    });
    expect(result.current).toMatchObject({ current: 2, playing: false });
  });

  it("with reduced motion only advances when asked", () => {
    const { result } = renderHook(() => useFlowPlayer(3, false));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(10 * STEP_DURATION_MS);
    });
    expect(result.current).toMatchObject({ current: 0, playing: false });
    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());
    expect(result.current.current).toBe(2);
    act(() => result.current.previous());
    expect(result.current.current).toBe(1);
    act(() => result.current.resume());
    expect(result.current.playing).toBe(false);
  });

  it("pauses when stepping by hand and clears on stop", () => {
    const { result } = renderHook(() => useFlowPlayer(3, true));
    act(() => result.current.start());
    act(() => result.current.next());
    expect(result.current).toMatchObject({ current: 1, playing: false });
    act(() => {
      vi.advanceTimersByTime(5 * STEP_DURATION_MS);
    });
    expect(result.current.current).toBe(1);
    act(() => result.current.stop());
    expect(result.current.current).toBeNull();
  });

  it("does nothing without steps", () => {
    const { result } = renderHook(() => useFlowPlayer(0, true));
    act(() => result.current.start());
    expect(result.current.current).toBeNull();
  });
});
