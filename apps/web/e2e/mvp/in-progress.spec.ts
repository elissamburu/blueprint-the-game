// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game in progress is kept in the browser (RF-PLAY-18): a reload brings back the same board,
// errors included, so the partial score does not change; «Finalizar» ends it and «Empezar de
// nuevo» discards it after a confirmation.
import { expect, test, type Page } from "@playwright/test";
import { expectNoBlockingViolations } from "../support/axe";
import {
  board,
  feedback,
  finish,
  onboard,
  place,
  playFromListing,
  slot,
  slotName,
  startDesigning,
  summaryFigures,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

/** The score of the game bar. */
const barScore = (page: Page) =>
  page.getByText("Puntaje", { exact: true }).locator("xpath=following-sibling::strong");

test("recargar a mitad de partida deja el tablero y el puntaje como estaban", async ({ page }) => {
  await test.step("colocar dos casilleros, uno con error", async () => {
    await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
    await playFromListing(page, CLUB_PHOTOS.title);
    await place(page, store.role, store.optimal);
    await expect(slot(page, store.role)).toHaveAccessibleName(
      slotName(store.number, "Óptimo", store.optimal),
    );
    await place(page, thumbnailer.role, thumbnailer.incorrect);
    await expect(feedback(page, "Incorrecto")).toBeVisible();
    await expect(barScore(page)).toHaveText("100");
  });

  await test.step("después de recargar, el tablero y el puntaje siguen iguales", async () => {
    await page.reload();
    const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
    await expect(brief.getByRole("status")).toHaveText(
      "Retomás tu partida en curso: el tablero quedó como lo dejaste.",
    );
    await expectNoBlockingViolations(page, "brief de una partida retomada");
    await startDesigning(page, CLUB_PHOTOS.title);
    await expect(slot(page, store.role)).toHaveAccessibleName(
      slotName(store.number, "Óptimo", store.optimal),
    );
    await expect(slot(page, thumbnailer.role)).toHaveAccessibleName(
      slotName(thumbnailer.number, "Incorrecto", thumbnailer.incorrect),
    );
    await expect(barScore(page)).toHaveText("100");
    await expect(page.getByText("1 de 3 casilleros")).toBeVisible();
  });

  await test.step("terminar: el error de antes de recargar se sigue descontando", async () => {
    // Activating the red slot opens its card again: «Probar otra» empties and selects it.
    await slot(page, thumbnailer.role).click();
    await feedback(page, "Incorrecto").getByRole("button", { name: "Probar otra" }).click();
    await page
      .getByRole("complementary", { name: "Paleta de servicios" })
      .getByRole("button", { name: thumbnailer.optimal, exact: true })
      .click();
    await expect(slot(page, thumbnailer.role)).toHaveAccessibleName(
      slotName(thumbnailer.number, "Óptimo", thumbnailer.optimal),
    );
    await place(page, index.role, index.optimal);
    // 100 + max(25, 100 − 25 · 1) + 100.
    await expect(barScore(page)).toHaveText("275");
    await finish(page);
    await expect(summaryFigures(page)).toContainText("275de 300");
  });

  await test.step("«Volver a jugar» empieza una partida nueva", async () => {
    await page.getByRole("link", { name: "Volver a jugar" }).first().click();
    const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
    await expect(brief).toBeVisible();
    await expect(brief.getByRole("status")).toHaveCount(0);
    await startDesigning(page, CLUB_PHOTOS.title);
    await expect(barScore(page)).toHaveText("0");
  });
});

test("«Empezar de nuevo» pide confirmación y deja el tablero vacío", async ({ page }) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);
  await place(page, store.role, store.optimal);
  await expect(barScore(page)).toHaveText("100");

  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Empezar de nuevo" }).click();
  const confirm = page.getByRole("alertdialog", { name: "¿Empezar de nuevo?" });
  await expect(confirm).toBeVisible();
  await expectNoBlockingViolations(page, "confirmación de «Empezar de nuevo»");
  await confirm.getByRole("button", { name: "Sí, empezar de nuevo" }).click();
  await expect(confirm).toBeHidden();
  await expect(board(page)).toBeFocused();
  await expect(barScore(page)).toHaveText("0");

  // Nothing comes back after a reload.
  await page.reload();
  const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
  await expect(brief).toBeVisible();
  await expect(brief.getByRole("status")).toHaveCount(0);
  await startDesigning(page, CLUB_PHOTOS.title);
  await expect(barScore(page)).toHaveText("0");
});
