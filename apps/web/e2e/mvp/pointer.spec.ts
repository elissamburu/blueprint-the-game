// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The controls of the board with a real mouse (issue #48). A hand moves the pointer a couple of
// pixels between the press and the release; on the board that press used to start a pan of React
// Flow, which then swallowed the click: "Ver pista" showed nothing. Each control has to open what
// it opens, keep it open, and neither pan the board nor activate the slot it belongs to. The step
// numbers of the edges are controls too (RF-PLAY-03): with the mouse and with the keyboard.
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

const { thumbnailer, index } = CLUB_PHOTOS.slots;
const REVEAL = "Ver pista (−15 pts)";

const openBoard = async (page: Page) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);
};

/** A step number of the board (RF-PLAY-03) and the popover it opens. */
const step = (page: Page, name: string) => board(page).getByRole("button", { name, exact: true });
const stepPopover = (page: Page, number: number) =>
  page.getByRole("dialog", { name: `Paso ${number}`, exact: true });

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
  await step(page, "Paso 2: Avisa que llegó").click();
  expect(await nestedControls(page), "con una pista vista, un casillero y un paso").toEqual([]);
});

test("un número de paso abre su etiqueta, descripción y recorrido con el mouse", async ({
  page,
}) => {
  await openBoard(page);
  const fourth = step(page, "Paso 4: Registra el resultado");
  const before = await boardTransform(page);

  await handClick(page, fourth);

  const popover = stepPopover(page, 4);
  await expect(popover).toBeVisible();
  await expect(popover).toContainText("Registra el resultado");
  await expect(popover).toContainText(
    "Cada miniatura deja una línea; los errores se revisan al día siguiente.",
  );
  // Origin → destination: a slot by its role, a fixed node by its service.
  await expect(popover).toContainText(`${thumbnailer.role.replace(/\.$/, "")} → Amazon CloudWatch`);
  await expect.poll(() => popover.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  await page.waitForTimeout(500);
  await expect(popover).toBeVisible();
  // The press did not drag the board.
  expect(await boardTransform(page)).toBe(before);

  // A step without description shows its label and route only.
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(fourth).toBeFocused();
  await handClick(page, step(page, "Paso 3: Anota la miniatura"));
  await expect(stepPopover(page, 3)).toContainText(
    `${thumbnailer.role.replace(/\.$/, "")} → ${index.role.replace(/\.$/, "")}`,
  );
});

test("los números de paso se usan con el teclado y el foco se ve", async ({ page }) => {
  await openBoard(page);
  const first = step(page, "Paso 1: Sube la foto");
  // The steps come after the slots and their hint buttons in the Tab order.
  await hintButton(page, REVEAL, index.number).focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  // Visible focus: the outline of :focus-visible (WCAG 2.4.7).
  expect(await first.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  const popover = stepPopover(page, 1);
  await expect(popover).toContainText("Sube la foto");
  await expect(popover).toContainText("Socio → ");
  await page.keyboard.press("Escape");
  await expect(popover).toBeHidden();
  await expect(first).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(step(page, "Paso 2: Avisa que llegó")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(stepPopover(page, 2)).toBeVisible();
});

test("el área de toque de un número de paso mide al menos 24 × 24 px", async ({ page }) => {
  await openBoard(page);
  // Alejado: the circle gets smaller, its press area does not.
  await page.getByRole("button", { name: "Alejar" }).click();
  await page.getByRole("button", { name: "Alejar" }).click();
  await page.waitForTimeout(300);
  for (const name of ["Paso 1: Sube la foto", "Paso 4: Registra el resultado"]) {
    const box = await step(page, name).boundingBox();
    expect(box?.width, name).toBeGreaterThanOrEqual(24);
    expect(box?.height, name).toBeGreaterThanOrEqual(24);
  }
});
