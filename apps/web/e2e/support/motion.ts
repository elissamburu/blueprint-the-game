// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What moves on screen (RF-PLAY-17), read from the running CSS animations and transitions of a
// real browser.
import type { Page } from "@playwright/test";

export interface ScreenAnimation {
  /** Element it runs on: tag, data-slot and classes, enough to tell it in a failure. */
  target: string;
  /** Keyframes of a CSS animation, or "transition:<property>". */
  name: string;
  /** Computed transform of the element at the start and in the middle of the animation. */
  transforms: [string, string];
  duration: number;
  delay: number;
  iterations: number;
}

/**
 * Slows every animation of the page down (Chromium DevTools protocol), so a 150 ms fade is still
 * running when the test looks at it. Returns the function that puts the speed back.
 */
export const slowAnimations = async (page: Page, rate = 0.02) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: rate });
  return async () => {
    await cdp.send("Animation.setPlaybackRate", { playbackRate: 1 });
  };
};

/**
 * The animations running now, each looked at in its first frame and halfway, then finished (so
 * nothing is left paused and axe can wait for the rest).
 */
export const screenAnimations = (page: Page): Promise<ScreenAnimation[]> =>
  page.evaluate(() =>
    document.getAnimations().map((animation) => {
      const effect = animation.effect instanceof KeyframeEffect ? animation.effect : null;
      const target = effect?.target ?? null;
      const timing = effect?.getComputedTiming();
      const duration = typeof timing?.duration === "number" ? timing.duration : 0;
      const delay = timing?.delay ?? 0;
      const transformAt = (time: number) => {
        animation.pause();
        animation.currentTime = time;
        return target === null ? "none" : getComputedStyle(target).transform;
      };
      const transforms: [string, string] = [transformAt(delay), transformAt(delay + duration / 2)];
      try {
        animation.finish();
      } catch {
        animation.cancel();
      }
      const name =
        animation instanceof CSSAnimation
          ? animation.animationName
          : animation instanceof CSSTransition
            ? `transition:${animation.transitionProperty}`
            : "?";
      const describe = (element: Element | null) =>
        element === null
          ? "?"
          : `${element.tagName.toLowerCase()}[data-slot=${element.getAttribute("data-slot") ?? ""}].${element.getAttribute("class") ?? ""}`;
      return {
        target: describe(target),
        name,
        transforms,
        duration,
        delay,
        iterations: timing?.iterations ?? 1,
      };
    }),
  );

/** The element did not move: no transform, or one that changes nothing. */
export const isStill = (transform: string): boolean =>
  transform === "none" || transform === "matrix(1, 0, 0, 1, 0, 0)";

/** Transition of the indicator of the game progress bar. */
export const progressTransition = (page: Page) =>
  page
    .locator("[data-slot=progress-indicator]")
    .first()
    .evaluate((el) => {
      const style = getComputedStyle(el);
      return { property: style.transitionProperty, duration: style.transitionDuration };
    });
