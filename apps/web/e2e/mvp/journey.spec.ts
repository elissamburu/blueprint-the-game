// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DoD of F1 (docs/05-roadmap.md): a guest goes from the onboarding to the summary of a scenario,
// with an error, a hint, an accepted orange and greens, and sees the XP, the new rank and the
// level it unlocked. Numbers come from the fixture game-rules.yaml (e2e/fixtures/content).
import { expect, test } from "@playwright/test";
import {
  emptySlotName,
  feedback,
  finish,
  headerRank,
  hintButton,
  onboard,
  paletteService,
  place,
  playFromListing,
  scenarioCard,
  slot,
  slotName,
  summaryFigures,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, PHOTO_QUEUE, RANKS } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

test("un invitado completa un escenario, sube de rango y desbloquea el nivel siguiente", async ({
  page,
}) => {
  await test.step("onboarding y listado", async () => {
    await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.first}`);
    await expect(scenarioCard(page, CLUB_PHOTOS.title)).toContainText("Nuevo");
    await expect(scenarioCard(page, PHOTO_QUEUE.title)).toContainText("Bloqueado");
  });

  await test.step("jugar: el brief y el tablero vacío", async () => {
    await playFromListing(page, CLUB_PHOTOS.title);
    await expect(page.getByRole("heading", { level: 1, name: CLUB_PHOTOS.title })).toBeVisible();
    await expect(page.getByText("0 de 3 casilleros")).toBeVisible();
    await expect(page.getByRole("button", { name: "Finalizar" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  await test.step("error: rojo con su explicación y la restricción que viola", async () => {
    await place(page, thumbnailer.role, thumbnailer.incorrect);
    await expect(slot(page, thumbnailer.role)).toHaveAccessibleName(
      slotName(thumbnailer.number, "Incorrecto", thumbnailer.incorrect),
    );
    const card = feedback(page, "Incorrecto");
    await expect(card).toContainText("Hay que administrar instancias.");
    await expect(card.getByRole("list", { name: "Objetivos" })).toContainText(
      "Viola: No administrar servidores.",
    );
  });

  await test.step("pista: se revela y cuesta puntos", async () => {
    await hintButton(page, "Ver pista (−15 pts)", thumbnailer.number).click();
    const hints = page.getByRole("dialog", { name: /^Pistas · / });
    await expect(hints).toContainText(thumbnailer.hints[0]);
    await expect(hints).not.toContainText(thumbnailer.hints[1]);
    await page.keyboard.press("Escape");
    await expect(hints).toBeHidden();
    await expect(page.getByText("Pistas 1/2")).toBeVisible();
  });

  await test.step("aceptable: «Me quedo con esta»", async () => {
    await feedback(page, "Incorrecto").getByRole("button", { name: "Probar otra" }).click();
    await expect(slot(page, thumbnailer.role)).toHaveAccessibleName(
      emptySlotName(thumbnailer.number),
    );
    await paletteService(page, thumbnailer.acceptable).click();
    const card = feedback(page, "Aceptable");
    await expect(card).toContainText("Contenedores sin servidores, pero con arranque más lento.");
    await card.getByRole("button", { name: "Me quedo con esta" }).click();
    await expect(card).toContainText("Te quedaste con esta");
    await expect(page.getByText("1 de 3 casilleros")).toBeVisible();
    await card.getByRole("button", { name: "Cerrar explicación" }).click();
  });

  await test.step("óptimo: verde al primer intento", async () => {
    await place(page, store.role, store.optimal);
    await expect(slot(page, store.role)).toHaveAccessibleName(
      slotName(store.number, "Óptimo", store.optimal),
    );
    await expect(feedback(page, "Óptimo")).toContainText(
      "Almacenamiento de objetos durable con pago por uso.",
    );
    await page.getByRole("button", { name: "Cerrar explicación" }).click();
    await place(page, index.role, index.optimal);
    await expect(slot(page, index.role)).toHaveAccessibleName(
      slotName(index.number, "Óptimo", index.optimal),
    );
    await expect(page.getByText("3 de 3 casilleros")).toBeVisible();
  });

  await test.step("resumen: puntaje, XP, rango y nivel desbloqueado", async () => {
    await finish(page);
    // 100 + 100 + (50 del aceptable − 15 de la pista) = 235 de 300; nivel 100 multiplica por 1.
    const figures = summaryFigures(page);
    await expect(figures).toContainText("235de 300");
    await expect(figures).toContainText("+235");
    await expect(figures).toContainText("235 pts × 1 (nivel 100) = 235 XP");
    await expect(figures).toContainText("2 óptimos");
    await expect(figures).toContainText("1 aceptable");
    const achievements = page.getByRole("region", { name: "Logros" });
    await expect(achievements.getByRole("listitem")).toHaveText([
      `Nuevo rangoSubiste a ${RANKS.second}.`,
      `Nivel desbloqueadoNivel 200 en ${AREAS.serverless} y ${AREAS.storage}.`,
    ]);
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
  });

  await test.step("el listado refleja el resultado y abre el nivel 200", async () => {
    await page.getByRole("link", { name: "Ver escenarios" }).click();
    const played = scenarioCard(page, CLUB_PHOTOS.title);
    await expect(played).toContainText("Mejor resultado: 235 de 300 puntos");
    await expect(played).toContainText("Completado");
    await expect(played).not.toContainText("Completado en verde");
    await expect(
      scenarioCard(page, PHOTO_QUEUE.title).getByRole("link", { name: /^Jugar «/ }),
    ).toBeVisible();
  });
});
