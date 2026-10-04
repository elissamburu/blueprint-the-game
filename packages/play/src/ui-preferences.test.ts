// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { PALETTE_COLLAPSED_KEY, readFlag, useFlagPreference, writeFlag } from "./ui-preferences";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("ui preferences", () => {
  it("remembers a flag in its own key, apart from the progress", () => {
    const { result, unmount } = renderHook(() => useFlagPreference(PALETTE_COLLAPSED_KEY));
    expect(result.current[0]).toBe(false);
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(PALETTE_COLLAPSED_KEY)).toBe("true");
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    unmount();

    const again = renderHook(() => useFlagPreference(PALETTE_COLLAPSED_KEY));
    expect(again.result.current[0]).toBe(true);
    act(() => again.result.current[1](false));
    expect(localStorage.getItem(PALETTE_COLLAPSED_KEY)).toBeNull();
  });

  it("works for the visit when the storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readFlag(PALETTE_COLLAPSED_KEY)).toBe(false);
    expect(() => writeFlag(PALETTE_COLLAPSED_KEY, true)).not.toThrow();
    const { result } = renderHook(() => useFlagPreference(PALETTE_COLLAPSED_KEY));
    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });
});
