// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The controls of the board with a real mouse (issue #48). A hand moves the pointer a couple of
// pixels between the press and the release; on the board that press used to start a pan of React
// Flow, which then swallowed the click: "Ver pista" showed nothing. Each control has to open what
// it opens, keep it open, and neither pan the board nor activate the slot it belongs to.
import { expect, test, type Page } from "@playwright/test";
import {
  board,
  boardTransform,
  handClick,
  hintButton,
  nestedControls,
  onboard,
  playFromListing,
  slot,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const { thumbnailer } = CLUB_PHOTOS.slots;
const REVEAL = "Ver pista (−15 pts)";

const openBoard = async (page: Page) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);
};

/** The opening zoom, and the board zoomed in (the tester did not play at 100 %). */
const ZOOMS = [
  { name: "con el zoom inicial", zoomIn: 0 },
  { name: "con el tablero acercado", zoomIn: 2 },
] as const;

for (const { name, zoomIn } of ZOOMS) {
  test(`«Ver pista» con el mouse muestra la pista y queda abierta, ${name}`, async ({ page }) => {
    await openBoard(page);
    for (let i = 0; i < zoomIn; i++) {
      await page.getByRole("button", { name: "Acercar" }).click();
    }
    const hint = hintButton(page, REVEAL, thumbnailer.number);
    // The slot is not selected and nothing was done on it before.
    await expect(slot(page, thumbnailer.role)).toHaveAttribute("aria-pressed", "false");
    await hint.scrollIntoViewIfNeeded();
    const before = await boardTransform(page);

    await handClick(page, hint);

    const hints = page.getByRole("dialog", { name: /^Pistas · / });
    await expect(hints).toBeVisible();
    await expect(hints).toContainText(thumbnailer.hints[0]);
    // Radix moves the focus into the popover (to the content or to its first control).
    const focusInside = () => hints.evaluate((el) => el.contains(document.activeElement));
    await expect.poll(focusInside).toBe(true);
    await page.waitForTimeout(500);
    await expect(hints).toBeVisible();
    expect(await focusInside()).toBe(true);
    // The click was the hint button's only: the slot was not activated and the board did not pan.
    await expect(slot(page, thumbnailer.role)).toHaveAttribute("aria-pressed", "false");
    expect(await boardTransform(page)).toBe(before);
  });
}

test("un casillero se selecciona con un clic de mouse que se mueve un poco", async ({ page }) => {
  await openBoard(page);
  const target = slot(page, thumbnailer.role);
  const before = await boardTransform(page);
  await handClick(page, target);
  await expect(target).toHaveAttribute("aria-pressed", "true");
  expect(await boardTransform(page)).toBe(before);
});

test("el tablero no anida controles interactivos", async ({ page }) => {
  await openBoard(page);
  await expect(board(page)).toBeVisible();
  expect(await nestedControls(page), "tablero vacío").toEqual([]);
  // With a hint revealed (its button changes) and a slot selected.
  await hintButton(page, REVEAL, thumbnailer.number).click();
  await page.keyboard.press("Escape");
  await slot(page, thumbnailer.role).click();
  expect(await nestedControls(page), "con una pista vista y un casillero elegido").toEqual([]);
});
