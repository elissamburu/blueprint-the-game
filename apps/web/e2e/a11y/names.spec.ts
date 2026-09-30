// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Accessible names of the controls that repeat in every slot of the board (WCAG 2.4.6): no two
// interactive controls of the board share a name. Each one ends with the number of its slot, the
// same one the summary shows, starts with its visible text (WCAG 2.5.3) and is described by the
// role of the slot. The names are read from the accessibility tree of the browser.
import { expect, test, type Page } from "@playwright/test";
import { controlsInside } from "../support/accessibility-tree";
import {
  emptySlotName,
  finish,
  hintButton,
  onboard,
  placeAll,
  playFromListing,
  slot,
  slotName,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;
const SLOTS = [store, thumbnailer, index];
const REVEAL = "Ver pista (−15 pts)";
const hintName = (text: string, number: number) => `${text}, casillero ${number}`;

const boardControls = (page: Page) =>
  controlsInside(page, { role: "group", name: /^Diagrama de «/ });

/**
 * The names of the slot controls of the board (its buttons), after checking that no interactive
 * control of the board, of any role, has an empty or a repeated name. The board has one more
 * control: the attribution link of React Flow.
 */
const uniqueNames = async (page: Page, state: string): Promise<string[]> => {
  const controls = await boardControls(page);
  const names = controls.map((control) => control.name);
  expect(names, `controles del tablero (${state})`).not.toHaveLength(0);
  expect(
    names.filter((name) => name.trim() === ""),
    `controles sin nombre accesible en el tablero (${state})`,
  ).toEqual([]);
  expect(
    names.filter((name, position) => names.indexOf(name) !== position),
    `nombres accesibles repetidos en el tablero (${state})`,
  ).toEqual([]);
  return controls.filter((control) => control.role !== "link").map((control) => control.name);
};

test("ningún control del tablero repite su nombre accesible", async ({ page }) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);

  await test.step("tablero vacío: un nombre por casillero y por botón de pistas", async () => {
    // Two slots with hints: with one, the hint buttons could not repeat a name.
    expect(await uniqueNames(page, "vacío")).toEqual([
      emptySlotName(store.number),
      emptySlotName(thumbnailer.number),
      hintName(REVEAL, thumbnailer.number),
      emptySlotName(index.number),
      hintName(REVEAL, index.number),
    ]);
  });

  await test.step("el rol describe cada control y no forma parte de su nombre", async () => {
    for (const { role } of SLOTS) {
      await expect(slot(page, role)).toHaveAccessibleDescription(role);
    }
    for (const { number, role } of [thumbnailer, index]) {
      const hint = hintButton(page, REVEAL, number);
      await expect(hint).toHaveAccessibleDescription(role);
      // WCAG 2.5.3: the name starts with the text the button shows.
      await expect(hint).toHaveText(REVEAL);
    }
    await expect(slot(page, store.role)).toContainText("Arrastrá o elegí un servicio");
  });

  await test.step("con pistas reveladas en dos casilleros", async () => {
    for (const { number } of [thumbnailer, index]) {
      await hintButton(page, REVEAL, number).click();
      await expect(page.getByRole("dialog", { name: /^Pistas · / })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: /^Pistas · / })).toBeHidden();
    }
    expect(await uniqueNames(page, "con pistas reveladas")).toEqual([
      emptySlotName(store.number),
      emptySlotName(thumbnailer.number),
      hintName("Ver pistas", thumbnailer.number),
      emptySlotName(index.number),
      hintName("Sin más pistas", index.number),
    ]);
  });

  await test.step("con todos los casilleros resueltos", async () => {
    await placeAll(page, SLOTS);
    const names = await uniqueNames(page, "resuelto");
    for (const { number, optimal } of SLOTS) {
      expect(names).toContain(slotName(number, "Óptimo", optimal));
    }
  });

  await test.step("el número es el del repaso del resumen", async () => {
    await finish(page);
    const review = page.getByRole("region", { name: "Casillero por casillero" });
    for (const { number, role } of SLOTS) {
      // The item of the review that shows the role of the slot has its number: the one on screen
      // and the "Casillero N" a screen reader gets instead.
      const item = review.getByRole("listitem").filter({ hasText: role });
      await expect(item).toHaveCount(1);
      await expect(item.getByText(String(number), { exact: true })).toBeVisible();
      await expect(item.getByText(`Casillero ${number}`, { exact: true })).toBeAttached();
    }
  });
});
