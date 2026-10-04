// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Animations (RF-PLAY-17, docs/design/motion-spec.md, docs/accesibilidad.md §3): placing a service,
// the result of a slot, the feedback card, the progress bar and the celebration of the summary.
// With prefers-reduced-motion nothing moves (fades only, no confetti, the bar jumps); without it,
// every animation plays once and all of them end within 1.5 s, the last confetti piece included.
import { expect, test, type Page } from "@playwright/test";
import { expectNoBlockingViolations } from "../support/axe";
import { feedback, finish, onboard, place, placeAll, playFromListing } from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";
import {
  isStill,
  progressTransition,
  screenAnimations,
  slowAnimations,
  type ScreenAnimation,
} from "../support/motion";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

const openGame = async (page: Page) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);
};

/** Animations that move their element, in a form that reads well in a failure. */
const moving = (animations: readonly ScreenAnimation[]) =>
  animations
    .filter((animation) => !animation.transforms.every(isStill))
    .map(({ name, target, transforms }) => `${name} en ${target}: ${transforms.join(" → ")}`);

const confetti = (page: Page) => page.locator(".motion-confetti i");

/** When an animation ends, from the moment it was started: its delay (a stagger) plus its run. */
const end = ({ delay, duration }: ScreenAnimation) => delay + duration;

/** The whole moment ends within 1.5 s, measured up to the animation that ends last. */
const LIMIT_MS = 1_500;

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("colocar, el resultado, el feedback y el resumen solo funden; la barra salta", async ({
    page,
  }) => {
    await openGame(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );
    expect((await progressTransition(page)).property).toBe("none");
    const restore = await slowAnimations(page);

    await place(page, thumbnailer.role, thumbnailer.optimal);
    await expect(feedback(page, "Óptimo")).toBeVisible();
    const placed = await screenAnimations(page);
    // The service, the grade and the card fade in.
    expect(placed.length).toBeGreaterThanOrEqual(3);
    expect(moving(placed)).toEqual([]);
    for (const animation of placed) expect(animation.duration).toBeLessThanOrEqual(150);
    expect((await progressTransition(page)).property).toBe("none");

    await restore();
    await expectNoBlockingViolations(page, "juego con movimiento reducido");

    await page.getByRole("button", { name: "Cerrar explicación" }).click();
    await placeAll(page, [store, index]);
    const restoreSummary = await slowAnimations(page);
    await finish(page);
    await expect(page.getByRole("region", { name: "Logros" })).toBeVisible();
    const summary = await screenAnimations(page);
    expect(moving(summary)).toEqual([]);
    await expect(confetti(page)).toHaveCount(0);
    await restoreSummary();
    await expectNoBlockingViolations(page, "resumen con movimiento reducido");
  });
});

test.describe("prefers-reduced-motion: no-preference", () => {
  test("cada momento se anima una sola vez y ninguno pasa de 1,5 s", async ({ page }) => {
    await openGame(page);
    const transition = await progressTransition(page);
    expect(transition.property).toContain("transform");
    expect(transition.duration).toBe("0.4s");
    const restore = await slowAnimations(page);

    await place(page, thumbnailer.role, thumbnailer.optimal);
    await expect(feedback(page, "Óptimo")).toBeVisible();
    const placed = await screenAnimations(page);
    // The service settles, the icon pops in, the card rises and the bar slides.
    expect(moving(placed).length).toBeGreaterThanOrEqual(4);
    for (const animation of placed) {
      expect(animation.iterations).toBe(1);
    }
    expect(Math.max(...placed.map(end))).toBeLessThanOrEqual(LIMIT_MS);

    // The card sinks out and is gone.
    await page.getByRole("button", { name: "Cerrar explicación" }).click();
    const leaving = await screenAnimations(page);
    expect(leaving.map((animation) => animation.name)).toContain("exit");
    await expect(page.locator("[data-slot-feedback]")).toHaveCount(0);

    await placeAll(page, [store, index]);
    await finish(page);
    await expect(page.getByRole("region", { name: "Logros" })).toBeVisible();
    await expect(confetti(page)).toHaveCount(10);
    const summary = await screenAnimations(page);
    expect(summary.map((animation) => animation.name)).toEqual(
      expect.arrayContaining(["motion-badge-in", "motion-confetti"]),
    );
    for (const animation of summary) {
      expect(animation.iterations).toBe(1);
    }
    // The last of the ten pieces starts 180 ms late: 180 + 1300 = 1480 ms.
    const confettiEnds = summary.filter((a) => a.name === "motion-confetti").map(end);
    expect(Math.max(...confettiEnds)).toBe(1_480);
    expect(Math.max(...summary.map(end))).toBeLessThanOrEqual(LIMIT_MS);
    await restore();
    // Decoration: hidden from assistive technology and from the pointer.
    await expect(page.locator(".motion-confetti")).toHaveAttribute("aria-hidden", "true");
    await expect(page.locator(".motion-confetti")).toHaveCSS("pointer-events", "none");
    await expectNoBlockingViolations(page, "resumen con animaciones");
  });
});
