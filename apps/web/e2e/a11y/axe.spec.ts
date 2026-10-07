// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe on the main screens and states of the MVP (docs/accesibilidad.md §7): no critical nor
// serious violations. It does not replace the manual tests of that protocol.
import { expect, test, type Page } from "@playwright/test";
import {
  feedback,
  finish,
  hintButton,
  onboard,
  paletteService,
  place,
  placeAll,
  playFromListing,
  scenarioCard,
  slot,
} from "../support/app";
import { expectNoBlockingViolations } from "../support/axe";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, PIZZERIA } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

const beginner = (page: Page) =>
  onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });

const revealStore = async (page: Page) => {
  await slot(page, store.role).click();
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver solución de este casillero" }).click();
};

test("onboarding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Armemos tu ruta de aprendizaje" })).toBeVisible();
  await expectNoBlockingViolations(page, "onboarding, vacío");
  await page.getByRole("button", { name: AREAS.serverless, exact: true }).click();
  await page.getByRole("radio", { name: EXPERIENCE.beginner, exact: true }).click();
  await expectNoBlockingViolations(page, "onboarding, con un área y la experiencia elegidas");
});

test("listado", async ({ page }) => {
  await beginner(page);
  await expect(scenarioCard(page, CLUB_PHOTOS.title)).toBeVisible();
  await expectNoBlockingViolations(page, "listado");
});

test("juego: brief, vacío, feedback de cada grado y pista", async ({ page }) => {
  // Several axe runs over the board, each one a few seconds.
  test.slow();
  await beginner(page);
  await scenarioCard(page, CLUB_PHOTOS.title).getByRole("link").click();
  const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
  await expect(brief).toBeVisible();
  await expectNoBlockingViolations(page, "juego, brief");

  await brief.getByRole("button", { name: "Empezar a diseñar" }).click();
  await expect(brief).toBeHidden();
  await expectNoBlockingViolations(page, "juego, vacío");

  await place(page, thumbnailer.role, thumbnailer.incorrect);
  await expect(feedback(page, "Incorrecto")).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con feedback incorrecto");

  await hintButton(page, "Ver pista (−15 pts)", thumbnailer.number).click();
  await expect(page.getByRole("dialog", { name: /^Pistas · / })).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con la pista abierta");
  await page.keyboard.press("Escape");

  await feedback(page, "Incorrecto").getByRole("button", { name: "Probar otra" }).click();
  await paletteService(page, thumbnailer.acceptable).click();
  await expect(feedback(page, "Aceptable")).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con feedback aceptable");

  await page.getByRole("button", { name: "Cerrar explicación" }).click();
  await place(page, index.role, index.optimal);
  await expect(feedback(page, "Óptimo")).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con feedback óptimo");
});

test("juego: «Ver caso», menú, aviso de solución, casillero revelado y paleta", async ({
  page,
}) => {
  test.slow();
  await beginner(page);
  await playFromListing(page, CLUB_PHOTOS.title);

  await page.getByRole("button", { name: "Ver caso" }).click();
  await expect(page.getByRole("dialog", { name: CLUB_PHOTOS.title })).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con «Ver caso» abierto");
  await page.getByRole("button", { name: "Cerrar el caso" }).click();

  await page.getByRole("button", { name: "Más acciones" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con el menú abierto");
  await page.keyboard.press("Escape");
  // Gone, not just closing: a click on "⋯" while it fades out would leave it closed.
  await expect(page.getByRole("menu")).toBeHidden();

  await revealStore(page);
  const notice = page.getByRole("alertdialog", { name: "¿Ver la solución de este casillero?" });
  await expect(notice).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con el aviso de solución abierto");

  await notice.getByRole("button", { name: "Ver solución" }).click();
  await expect(feedback(page, "Solución vista")).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con un casillero revelado");

  await page.getByRole("button", { name: "Reproducir flujo" }).click();
  await expect(page.getByRole("group", { name: "Reproductor de flujo" })).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con el reproductor de flujo");

  await page.getByRole("button", { name: "Colapsar la paleta" }).click();
  await expect(page.getByRole("button", { name: "Expandir la paleta" })).toBeVisible();
  await expectNoBlockingViolations(page, "juego, con la paleta colapsada");
});

test.describe("forced-colors: active", () => {
  test.use({ contextOptions: { forcedColors: "active" } });

  test("juego con un casillero revelado", async ({ page }) => {
    await beginner(page);
    await playFromListing(page, CLUB_PHOTOS.title);
    await expectNoBlockingViolations(page, "juego vacío, colores forzados");
    await place(page, thumbnailer.role, thumbnailer.optimal);
    await page.getByRole("button", { name: "Cerrar explicación" }).click();
    await revealStore(page);
    await page.getByRole("alertdialog").getByRole("button", { name: "Ver solución" }).click();
    await expect(feedback(page, "Solución vista")).toBeVisible();
    await expectNoBlockingViolations(page, "juego con un casillero revelado, colores forzados");
  });

  // With the primary button enabled: axe does not measure the contrast of a disabled control.
  test("botón primario habilitado: onboarding, brief y juego completo", async ({ page }) => {
    test.slow();
    await page.goto("/");
    await page.getByRole("button", { name: AREAS.serverless, exact: true }).click();
    await page.getByRole("radio", { name: EXPERIENCE.beginner, exact: true }).click();
    await expect(page.getByRole("button", { name: "Ver mi ruta" })).toBeEnabled();
    await expectNoBlockingViolations(page, "onboarding completo, colores forzados");
    await page.getByRole("button", { name: "Ver mi ruta" }).click();

    await scenarioCard(page, CLUB_PHOTOS.title).getByRole("link").click();
    const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
    await expect(brief).toBeVisible();
    await expectNoBlockingViolations(page, "brief, colores forzados");
    await brief.getByRole("button", { name: "Empezar a diseñar" }).click();

    await placeAll(page, [store, thumbnailer, index]);
    await expect(page.getByRole("button", { name: "Finalizar" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    await expectNoBlockingViolations(page, "juego completo, colores forzados");
  });
});

test("resumen", async ({ page }) => {
  await beginner(page);
  await playFromListing(page, CLUB_PHOTOS.title);
  // An accepted orange, a viewed solution and a green: every kind of review item.
  await place(page, thumbnailer.role, thumbnailer.acceptable);
  await feedback(page, "Aceptable").getByRole("button", { name: "Me quedo con esta" }).click();
  await page.getByRole("button", { name: "Cerrar explicación" }).click();
  await revealStore(page);
  await page.getByRole("alertdialog").getByRole("button", { name: "Ver solución" }).click();
  await page.getByRole("button", { name: "Cerrar explicación" }).click();
  await placeAll(page, [index]);
  await finish(page);
  await expect(page.getByText("Completado viendo la solución de 1 casillero")).toBeVisible();
  await expectNoBlockingViolations(page, "resumen");
});

test("perfil, con y sin el diálogo de reinicio", async ({ page }) => {
  await beginner(page);
  await playFromListing(page, CLUB_PHOTOS.title);
  await placeAll(page, [store, thumbnailer, index]);
  await finish(page);
  await page.getByRole("link", { name: "Ver escenarios" }).click();
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Perfil" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Tu perfil" })).toBeVisible();
  await expectNoBlockingViolations(page, "perfil");

  await page.getByRole("button", { name: "Reiniciar progreso" }).click();
  await expect(page.getByRole("alertdialog", { name: "¿Reiniciar tu progreso?" })).toBeVisible();
  await expectNoBlockingViolations(page, "perfil, con el diálogo de reinicio");
});

test("acerca de", async ({ page }) => {
  await page.goto("/acerca");
  await expect(page.getByRole("heading", { level: 1, name: "Acerca de Blueprint" })).toBeVisible();
  await expectNoBlockingViolations(page, "acerca de");
});

test("nivel 0: juego con la paleta expandida y colapsada, y feedback con la analogía", async ({
  page,
}) => {
  test.slow();
  // «Recién empiezo con la nube» already marks «Fundamentos de la nube».
  await onboard(page, { areas: [], experience: EXPERIENCE.newcomer });
  await playFromListing(page, PIZZERIA.title);
  await expectNoBlockingViolations(page, "nivel 0, vacío");

  const { recipes } = PIZZERIA.slots;
  await place(page, recipes.role, recipes.optimal);
  const card = feedback(page, "Óptimo");
  await expect(card.getByRole("group", { name: "Dónde se rompe la analogía" })).toBeVisible();
  await expectNoBlockingViolations(page, "nivel 0, con feedback y la analogía");

  await page.getByRole("button", { name: "Cerrar explicación" }).click();
  await page.getByRole("button", { name: "Colapsar la paleta" }).click();
  await expectNoBlockingViolations(page, "nivel 0, con la paleta colapsada");
});
