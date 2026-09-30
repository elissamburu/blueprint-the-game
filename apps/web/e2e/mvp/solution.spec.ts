// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Mostrar solución" (RF-PLAY-14, DoD of F1.1): one slot and the whole scenario, behind a notice
// that invites to use a hint first. A viewed solution gives 0 points, the summary says the
// scenario was completed that way and the previous best result does not go down.
import { expect, test, type Page } from "@playwright/test";
import {
  emptySlotName,
  feedback,
  finish,
  onboard,
  placeAll,
  playFromListing,
  scenarioCard,
  slot,
  slotName,
  startDesigning,
  summaryFigures,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

const openMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Más acciones" }).click();
  return page.getByRole("menu");
};

test("ver la solución de un casillero y la completa no baja el mejor resultado", async ({
  page,
}) => {
  await test.step("primer intento: todo en verde", async () => {
    await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
    await playFromListing(page, CLUB_PHOTOS.title);
    await placeAll(page, [store, thumbnailer, index]);
    await finish(page);
    await expect(summaryFigures(page)).toContainText("300de 300");
    await expect(summaryFigures(page)).toContainText("+300");
  });

  await test.step("volver a jugar: sin casillero elegido no hay solución por casillero", async () => {
    await page.getByRole("link", { name: "Volver a jugar" }).click();
    await startDesigning(page, CLUB_PHOTOS.title);
    const menu = await openMenu(page);
    const item = menu.getByRole("menuitem", { name: /^Ver solución de este casillero/ });
    await expect(item).toBeDisabled();
    await expect(item).toContainText("Elegí un casillero sin resolver");
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  await test.step("el aviso invita a usar una pista cuando el casillero tiene", async () => {
    await slot(page, thumbnailer.role).click();
    const menu = await openMenu(page);
    await menu.getByRole("menuitem", { name: "Ver solución de este casillero" }).click();
    const notice = page.getByRole("alertdialog", { name: "¿Ver la solución de este casillero?" });
    await expect(notice).toContainText(`Casillero: ${thumbnailer.role}`);
    await expect(notice).toContainText("¿Querés probar con una pista primero?");
    await expect(notice.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await notice.getByRole("button", { name: "Usar una pista" }).click();
    await expect(notice).toBeHidden();
    await expect(page.getByText("Pistas 1/2")).toBeVisible();
    await expect(slot(page, thumbnailer.role)).toHaveAccessibleName(
      emptySlotName(thumbnailer.number),
    );
  });

  await test.step("solución de un casillero: se muestra, explicada, sin puntos", async () => {
    await slot(page, store.role).click();
    const menu = await openMenu(page);
    await menu.getByRole("menuitem", { name: "Ver solución de este casillero" }).click();
    const notice = page.getByRole("alertdialog", { name: "¿Ver la solución de este casillero?" });
    await expect(notice).toContainText("este casillero no suma puntos");
    // No hints in this slot: nothing to offer instead.
    await expect(notice.getByRole("button", { name: "Usar una pista" })).toHaveCount(0);
    await notice.getByRole("button", { name: "Ver solución" }).click();
    await expect(slot(page, store.role)).toHaveAccessibleName(
      slotName(store.number, "Solución vista", store.optimal),
    );
    await expect(slot(page, store.role)).toBeFocused();
    const card = feedback(page, "Solución vista");
    await expect(card).toContainText("No suma puntos");
    await expect(card).toContainText("Almacenamiento de objetos durable con pago por uso.");
    await expect(page.getByText("1 de 3 casilleros")).toBeVisible();
  });

  await test.step("solución completa: los casilleros que faltan", async () => {
    const menu = await openMenu(page);
    await menu.getByRole("menuitem", { name: "Ver solución completa" }).click();
    const notice = page.getByRole("alertdialog", { name: "¿Ver la solución completa?" });
    await expect(notice).toContainText("la solución de los 2 casilleros que faltan");
    await notice.getByRole("button", { name: "Ver solución completa" }).click();
    for (const { number, role, optimal } of [store, thumbnailer, index]) {
      await expect(slot(page, role)).toHaveAccessibleName(
        slotName(number, "Solución vista", optimal),
      );
    }
    await expect(page.getByText("3 de 3 casilleros")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar" })).toBeFocused();
  });

  await test.step("resumen: completado viendo la solución, sin XP", async () => {
    await finish(page);
    await expect(page.getByText("Completado viendo la solución de 3 casilleros")).toBeVisible();
    const figures = summaryFigures(page);
    // Every slot viewed: 0 points, minus nothing (the hint of a viewed slot cannot go below 0).
    await expect(figures).toContainText("0de 300");
    await expect(figures).toContainText("+0");
    await expect(figures).toContainText("Tu mejor resultado ya era mayor: +0 XP");
    await expect(figures).toContainText("0 óptimos");
    await expect(figures).toContainText("3 soluciones vistas");
    await expect(page.getByRole("region", { name: "Logros" })).toHaveCount(0);
  });

  await test.step("el mejor resultado anterior sigue siendo el verde de 300", async () => {
    await page.getByRole("link", { name: "Ver escenarios" }).click();
    const card = scenarioCard(page, CLUB_PHOTOS.title);
    await expect(card).toContainText("Mejor resultado: 300 de 300 puntos");
    await expect(card).toContainText("Completado en verde");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Perfil" })
      .click();
    await expect(page.getByRole("region", { name: "Escenarios completados" })).toContainText(
      "Mejor puntaje: 300 de 300 · 300 XP",
    );
  });
});
