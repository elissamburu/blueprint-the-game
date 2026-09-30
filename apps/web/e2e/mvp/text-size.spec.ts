// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimum text sizes (docs/design/README.md, problem 28; docs/accesibilidad.md §2): outside the
// board no visible text is rendered below 12 px at the default font size. Inside the board the
// text is in px on purpose and scales with the board zoom, so the board is left out. The service
// icons are blocked here, so the initials every icon falls back to are measured too.
import { expect, test, type Page } from "@playwright/test";
import {
  feedback,
  finish,
  onboard,
  paletteService,
  place,
  placeAll,
  scenarioCard,
  slot,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, PHOTO_QUEUE } from "../support/fixture";

const MIN_PX = 12;
const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

/** Visible text below `min` px outside the board and its still preview, as "12.5px «texto»". */
const smallText = (page: Page, min: number) =>
  page.evaluate((minPx) => {
    // The board and its preview in the brief, by their semantics (not by CSS classes).
    const BOARD = '[aria-roledescription="diagrama"], [role="img"]:has([inert])';
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const text = node.textContent?.trim() ?? "";
      const element = node.parentElement;
      if (text === "" || element === null || element.closest(BOARD) !== null) continue;
      if (element.closest("script, style, noscript, title") !== null) continue;
      if (!element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      // Text for screen readers only is clipped to one pixel: it is not visible text.
      const clip = element.getBoundingClientRect();
      if (clip.width <= 1 || clip.height <= 1) continue;
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      if (size < minPx) found.add(`${size}px «${text.slice(0, 60)}»`);
    }
    return [...found];
  }, min);

const expectReadable = async (page: Page, screen: string) => {
  expect
    .soft(await smallText(page, MIN_PX), `texto menor a ${MIN_PX} px en «${screen}»`)
    .toEqual([]);
};

test("fuera del tablero ningún texto visible baja de 12 px", async ({ page }) => {
  await page.route("**/icons/*.svg", (route) => route.abort());

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Armemos tu ruta de aprendizaje" })).toBeVisible();
  await expectReadable(page, "onboarding");

  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await expect(scenarioCard(page, CLUB_PHOTOS.title)).toBeVisible();
  await expectReadable(page, "listado");

  await page.goto(`/escenarios/${PHOTO_QUEUE.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Escenario bloqueado" })).toBeVisible();
  await expectReadable(page, "escenario bloqueado");

  await page.goto("/no-existe");
  await expect(page.getByRole("heading", { level: 1, name: "Página no encontrada" })).toBeVisible();
  await expectReadable(page, "página no encontrada");

  await page.goto(`/escenarios/${CLUB_PHOTOS.id}`);
  const brief = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
  await expect(brief).toBeVisible();
  await expectReadable(page, "juego, brief");
  await brief.getByRole("button", { name: "Empezar a diseñar" }).click();
  await expect(brief).toBeHidden();
  await expectReadable(page, "juego, vacío");

  await place(page, thumbnailer.role, thumbnailer.incorrect);
  await expect(feedback(page, "Incorrecto")).toBeVisible();
  await expectReadable(page, "juego, con feedback");

  await page.getByRole("button", { name: "Ver pista (−15 pts)" }).click();
  const hints = page.getByRole("dialog", { name: /^Pistas · / });
  await expect(hints).toBeVisible();
  await expectReadable(page, "juego, con la pista abierta");
  await hints.getByRole("button", { name: "Ver otra pista (−15 pts)" }).click();
  await expect(hints).toContainText("Sin más pistas");
  await expectReadable(page, "juego, sin más pistas");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Finalizar" }).hover();
  // Besides the description of the button for screen readers, the tooltip shows the text.
  await expect.poll(() => page.getByText("Faltan 3 casilleros").count()).toBeGreaterThan(1);
  await expectReadable(page, "juego, con el tooltip de «Finalizar»");

  await page.getByRole("button", { name: "Ver caso" }).click();
  await expect(page.getByRole("dialog", { name: CLUB_PHOTOS.title })).toBeVisible();
  await expectReadable(page, "juego, con «Ver caso» abierto");
  await page.getByRole("button", { name: "Cerrar el caso" }).click();

  await feedback(page, "Incorrecto").getByRole("button", { name: "Probar otra" }).click();
  await paletteService(page, thumbnailer.acceptable).click();
  await feedback(page, "Aceptable").getByRole("button", { name: "Me quedo con esta" }).click();
  await expectReadable(page, "juego, con un aceptable aceptado");
  await page.getByRole("button", { name: "Cerrar explicación" }).click();

  await page.getByRole("button", { name: "Más acciones" }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expectReadable(page, "juego, con el menú abierto");
  await page.keyboard.press("Escape");
  // Gone, not just closing: a click on "⋯" while it fades out would leave it closed.
  await expect(page.getByRole("menu")).toBeHidden();

  await slot(page, store.role).click();
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver solución de este casillero" }).click();
  const notice = page.getByRole("alertdialog");
  await expect(notice).toBeVisible();
  await expectReadable(page, "juego, con el aviso de solución");
  await notice.getByRole("button", { name: "Ver solución" }).click();
  await expect(feedback(page, "Solución vista")).toBeVisible();
  await expectReadable(page, "juego, con un casillero revelado");
  await page.getByRole("button", { name: "Cerrar explicación" }).click();

  await page.getByRole("button", { name: "Reproducir flujo" }).click();
  await expect(page.getByRole("group", { name: "Reproductor de flujo" })).toBeVisible();
  await expectReadable(page, "juego, con el reproductor de flujo");
  await page.getByRole("button", { name: "Detener" }).click();

  await page.getByRole("button", { name: "Modo foco" }).click();
  await expect(page.getByRole("button", { name: "Salir del foco" })).toBeVisible();
  await expectReadable(page, "juego, modo foco");
  await page.getByRole("button", { name: "Salir del foco" }).click();

  await page.getByRole("button", { name: "Colapsar la paleta" }).click();
  await page.getByRole("button", { name: /^Amazon DynamoDB/ }).hover();
  await expect(page.getByRole("tooltip")).toBeVisible();
  await expectReadable(page, "juego, con la paleta colapsada y su tooltip");
  await page.getByRole("button", { name: "Expandir la paleta" }).click();

  await placeAll(page, [index]);
  await finish(page);
  await expectReadable(page, "resumen");

  await page.getByRole("link", { name: "Ver escenarios" }).click();
  await expect(scenarioCard(page, CLUB_PHOTOS.title)).toContainText("Mejor resultado");
  await expectReadable(page, "listado, con un escenario completado");

  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Perfil" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Tu perfil" })).toBeVisible();
  await expectReadable(page, "perfil");
  await page.getByRole("button", { name: "Reiniciar progreso" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expectReadable(page, "perfil, con el diálogo de reinicio");
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.getByRole("contentinfo").getByRole("link", { name: "Acerca de" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Acerca de Blueprint" })).toBeVisible();
  await expectReadable(page, "acerca de");
});
