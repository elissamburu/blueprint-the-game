// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useReducedMotion } from "./use-reduced-motion";

const QUERY = "(prefers-reduced-motion: reduce)";

/** A matchMedia whose answer the test changes, telling its listeners like a browser. */
const fakeMedia = (initial: boolean) => {
  let matches = initial;
  const listeners = new Set<() => void>();
  const list = {
    get matches() {
      return matches;
    },
    media: QUERY,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  Reflect.set(window, "matchMedia", (query: string) =>
    query === QUERY ? list : { ...list, matches: false },
  );
  return {
    listeners,
    set: (value: boolean) => {
      matches = value;
      for (const listener of listeners) listener();
    },
  };
};

// jsdom has no matchMedia: each test puts its own and this takes it out.
afterEach(() => {
  Reflect.deleteProperty(window, "matchMedia");
});

describe("useReducedMotion", () => {
  it("is false without matchMedia (jsdom, old browsers)", () => {
    expect(renderHook(() => useReducedMotion()).result.current).toBe(false);
  });

  it("reads the system preference and follows its changes while the page is open", () => {
    const media = fakeMedia(true);
    const { result, unmount } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
    act(() => media.set(false));
    expect(result.current).toBe(false);
    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
