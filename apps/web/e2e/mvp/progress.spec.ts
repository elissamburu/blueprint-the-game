// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Guest progress lives in the browser (ADR-0010): a reload keeps the XP, the unlocked levels and
// the scenarios in progress, and "Reiniciar progreso" goes back to the onboarding.
import { expect, test } from "@playwright/test";
import {
  finish,
  headerRank,
  onboard,
  place,
  placeAll,
  playFromListing,
  scenarioCard,
  slot,
  slotName,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, PHOTO_QUEUE, RANKS } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;
const { buffer } = PHOTO_QUEUE.slots;

test("recargar conserva el progreso y «Reiniciar progreso» vuelve al onboarding", async ({
  page,
}) => {
  await test.step("completar un escenario y dejar otro en curso", async () => {
    await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
    await playFromListing(page, CLUB_PHOTOS.title);
    await placeAll(page, [store, thumbnailer, index]);
    await finish(page);
    await page.getByRole("link", { name: "Ver escenarios" }).click();

    // Level 200 opened with the result: one placement makes it "en curso".
    await playFromListing(page, PHOTO_QUEUE.title);
    await place(page, buffer.role, buffer.optimal);
    await expect(slot(page, buffer.role)).toHaveAccessibleName(
      slotName(buffer.number, "Óptimo", buffer.optimal),
    );
    await page.getByRole("link", { name: "Volver a escenarios" }).click();
    await expect(scenarioCard(page, PHOTO_QUEUE.title)).toContainText("En curso");
  });

  await test.step("después de recargar sigue todo", async () => {
    await page.reload();
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
    const completed = scenarioCard(page, CLUB_PHOTOS.title);
    await expect(completed).toContainText("Completado en verde");
    await expect(completed).toContainText("Mejor resultado: 300 de 300 puntos");
    const started = scenarioCard(page, PHOTO_QUEUE.title);
    await expect(started).toContainText("En curso");
    await expect(started.getByRole("link", { name: /^Jugar «/ })).toBeVisible();
    await expect(
      page.getByRole("link", { name: `Continuar escenario «${PHOTO_QUEUE.title}»` }),
    ).toBeVisible();
  });

  await test.step("el perfil muestra XP, rango y niveles abiertos", async () => {
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Perfil" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Tu perfil" })).toBeVisible();
    await expect(page.getByText("1 escenario completado")).toBeVisible();
    const rank = page.getByRole("region", { name: "Rango actual" });
    await expect(rank).toContainText(RANKS.second);
    await expect(rank).toContainText("300 de 2.000 XP para alcanzar Arquitecto");
    const unlocked = page.getByRole("region", { name: "Niveles desbloqueados" });
    await expect(unlocked.getByRole("definition")).toHaveText([
      "Nivel 100Nivel 200",
      "Nivel 100Nivel 200",
    ]);
  });

  await test.step("cancelar el reinicio no borra nada", async () => {
    await page.getByRole("button", { name: "Reiniciar progreso" }).click();
    const confirm = page.getByRole("alertdialog", { name: "¿Reiniciar tu progreso?" });
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    await expect(page.getByText("1 escenario completado")).toBeVisible();
  });

  await test.step("reiniciar vuelve al onboarding, también después de recargar", async () => {
    await page.getByRole("button", { name: "Reiniciar progreso" }).click();
    await page
      .getByRole("alertdialog", { name: "¿Reiniciar tu progreso?" })
      .getByRole("button", { name: "Sí, reiniciar" })
      .click();
    const welcome = page.getByRole("heading", { name: "Armemos tu ruta de aprendizaje" });
    await expect(page).toHaveURL(/\/bienvenida$/);
    await expect(welcome).toBeVisible();
    await page.reload();
    await expect(welcome).toBeVisible();
    await page.goto("/escenarios");
    await expect(page).toHaveURL(/\/bienvenida$/);
    await expect(welcome).toBeVisible();
  });
});
