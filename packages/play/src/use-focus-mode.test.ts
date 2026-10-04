// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFocusMode } from "./use-focus-mode";

/** A browser whose Fullscreen API grants or refuses the request. */
const fakeFullscreen = (grant: boolean) => {
  let element: Element | null = null;
  const change = () => document.dispatchEvent(new Event("fullscreenchange"));
  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => element,
  });
  // The hook asks for the whole document (checked with mock.contexts).
  const request = vi.fn(function (this: Element) {
    if (!grant) return Promise.reject(new TypeError("Permissions check failed"));
    element = document.documentElement;
    change();
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    element = null;
    change();
    return Promise.resolve();
  });
  Object.defineProperty(Element.prototype, "requestFullscreen", {
    configurable: true,
    value: request,
  });
  Object.defineProperty(document, "exitFullscreen", { configurable: true, value: exit });
  /** The player pressed Esc: the browser leaves full screen by itself. */
  const escape = () => {
    element = null;
    change();
  };
  return { request, exit, escape };
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(document, "exitFullscreen");
  Reflect.deleteProperty(Element.prototype, "requestFullscreen");
});

describe("useFocusMode", () => {
  it("asks for full screen on the whole document and gives it back on exit", async () => {
    const api = fakeFullscreen(true);
    const { result } = renderHook(() => useFocusMode());
    await act(() => result.current.enter());
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(api.request.mock.contexts[0]).toBe(document.documentElement);
    expect(result.current).toMatchObject({ active: true, fullscreen: true });
    await act(() => result.current.exit());
    expect(api.exit).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ active: false, fullscreen: false });
  });

  it("stays in focus mode when the browser refuses full screen", async () => {
    const api = fakeFullscreen(false);
    const { result } = renderHook(() => useFocusMode());
    await act(() => result.current.enter());
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(result.current).toMatchObject({ active: true, fullscreen: false });
    await act(() => result.current.exit());
    expect(api.exit).not.toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it("stays in focus mode without the Fullscreen API", async () => {
    const { result } = renderHook(() => useFocusMode());
    await act(() => result.current.enter());
    expect(result.current).toMatchObject({ active: true, fullscreen: false });
  });

  it("stays in focus mode when the player leaves full screen with Esc", async () => {
    const api = fakeFullscreen(true);
    const { result } = renderHook(() => useFocusMode());
    await act(() => result.current.enter());
    act(() => api.escape());
    expect(result.current).toMatchObject({ active: true, fullscreen: false });
  });

  it("leaves full screen when the game screen goes away", async () => {
    const api = fakeFullscreen(true);
    const { result, unmount } = renderHook(() => useFocusMode());
    await act(() => result.current.enter());
    unmount();
    expect(api.exit).toHaveBeenCalledTimes(1);
  });
});
