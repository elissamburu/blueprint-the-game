// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What a player does on each screen, for the specs. Every element is found by its role and
// accessible name, as assistive technologies find it: never by CSS classes.
import { expect, type Locator, type Page } from "@playwright/test";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The onboarding: areas of interest, experience and "Ver mi ruta". Ends on the listing. */
export const onboard = async (
  page: Page,
  { areas, experience }: { areas: readonly string[]; experience: string },
) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Armemos tu ruta de aprendizaje" })).toBeVisible();
  for (const area of areas) {
    await page.getByRole("button", { name: area, exact: true }).click();
  }
  await page.getByRole("radio", { name: experience }).click();
  await page.getByRole("button", { name: "Ver mi ruta" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
};

/** The card of a scenario in the listing. */
export const scenarioCard = (page: Page, title: string): Locator =>
  page.getByRole("article", { name: title });

/** From the listing: opens the scenario of a card and leaves the brief. */
export const playFromListing = async (page: Page, title: string) => {
  await scenarioCard(page, title)
    .getByRole("link", { name: /^(Jugar|Volver a jugar) «/ })
    .click();
  await startDesigning(page, title);
};

/** Closes the brief with "Empezar a diseñar": the board is ready. */
export const startDesigning = async (page: Page, title: string) => {
  const brief = page.getByRole("dialog", { name: title });
  await brief.getByRole("button", { name: "Empezar a diseñar" }).click();
  await expect(brief).toBeHidden();
  await expect(board(page)).toBeVisible();
};

export const board = (page: Page): Locator => page.getByRole("group", { name: /^Diagrama de «/ });

export const palette = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Paleta de servicios" });

/**
 * A slot of the board, whatever its state, by the role it shows. The role is its accessible
 * description; its name is `slotName` or `emptySlotName`.
 */
export const slot = (page: Page, role: string): Locator =>
  board(page)
    .getByRole("button")
    .filter({ has: page.getByText(role, { exact: true }) });

/** Exact accessible name of a slot with a service: `slotName(2, "Óptimo", "Amazon S3")`. */
export const slotName = (number: number, state: string, service: string): string =>
  `${state}: ${service}, casillero ${number}`;

/** Exact accessible name of an empty slot: its placeholder and its number. */
export const emptySlotName = (number: number): string =>
  `Arrastrá o elegí un servicio, casillero ${number}`;

/**
 * The hint button of a slot, by the exact name of its state: `hintButton(page, "Ver pistas", 2)`.
 */
export const hintButton = (page: Page, text: string, number: number): Locator =>
  board(page).getByRole("button", { name: `${text}, casillero ${number}`, exact: true });

/** A service of the palette (its name gets "En uso" once it is placed in some slot). */
export const paletteService = (page: Page, service: string): Locator =>
  palette(page).getByRole("button", {
    name: new RegExp(`^${escapeRegExp(service)}(\\s*En uso)?$`),
  });

/** The feedback card of the slot just evaluated: its title starts with the grade. */
export const feedback = (page: Page, grade: string): Locator =>
  page.getByRole("region", { name: new RegExp(`^${escapeRegExp(grade)}`) });

/** Slot first, then the service, with the mouse. */
export const place = async (page: Page, role: string, service: string) => {
  await slot(page, role).click();
  await paletteService(page, service).click();
};

/** Places the optimal service of every given slot, closing each explanation. */
export const placeAll = async (
  page: Page,
  slots: readonly { readonly number: number; readonly role: string; readonly optimal: string }[],
) => {
  for (const { number, role, optimal } of slots) {
    await place(page, role, optimal);
    await expect(slot(page, role)).toHaveAccessibleName(slotName(number, "Óptimo", optimal));
    await page.getByRole("button", { name: "Cerrar explicación" }).click();
  }
};

/** "Finalizar" and the summary it opens. */
export const finish = async (page: Page) => {
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Escenario completado" })).toBeVisible();
};

/** The three figures of the summary (score, XP, slots). */
export const summaryFigures = (page: Page): Locator =>
  page.getByRole("region", { name: "Resultado" });

/** The player's rank in the header ("Rango: <nombre>"). */
export const headerRank = (page: Page): Locator => page.getByRole("banner").getByRole("paragraph");
