// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Printable version of a scenario (RF-PLAY-16) over the real content: reached from the "⋯" menu
// of the game, printed without the bars and controls, one sheet per section, a PDF of several
// pages with and without solutions (page.pdf only exists in Chromium), and axe on the screen view.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { onboard, playFromListing } from "../support/app";
import { loadDevBundle } from "../support/dev-bundle";

const bundle = loadDevBundle();
const ID = "serverless-pdf-processing";
const entry = bundle.scenarios.find((s) => s.id === ID);

const pdfPages = (pdf: Buffer): number => pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;

/** "Experto" opens every level, then the printable page of the scenario from the "⋯" menu. */
const openFromMenu = async (page: Page, title: string) => {
  await onboard(page, { areas: bundle.areas.slice(0, 1), experience: "Experto" });
  await playFromListing(page, title);
  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Versión imprimible" }).click();
  await expect(page).toHaveURL(new RegExp(`/escenarios/${ID}/imprimir$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
  // The diagram is drawn (React Flow measured its nodes) before anything is printed.
  await expect(page.locator('[data-slot="diagram-print"] .react-flow__node').first()).toBeVisible();
};

const solutionsCheckbox = (page: Page) =>
  page.getByRole("checkbox", { name: "Incluir soluciones" });

test.describe("versión imprimible", () => {
  test.skip(entry === undefined, `${ID} no está en el bundle de desarrollo`);
  const title = entry?.title ?? "";

  test("se abre desde el menú ⋯ y al imprimir quedan solo las hojas, cada una en página nueva", async ({
    page,
  }) => {
    await openFromMenu(page, title);
    const controls = page.getByRole("region", { name: "Opciones de impresión" });
    await expect(controls.getByRole("button", { name: "Imprimir" })).toBeVisible();
    await expect(page.getByRole("banner")).toBeVisible();

    await solutionsCheckbox(page).check();
    await page.emulateMedia({ media: "print" });
    await expect(controls).toBeHidden();
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.getByRole("region", { name: "Aviso de versión beta" })).toBeHidden();
    // Nothing of the game screen is on the page: neither its bar, nor the palette, nor the board.
    await expect(page.getByRole("button", { name: "Más acciones" })).toHaveCount(0);
    await expect(page.getByRole("complementary", { name: "Paleta de servicios" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Zoom" })).toHaveCount(0);

    const sheets = page.locator("[data-print-sheet]");
    // The case, the diagram, the solutions and every slot after the first.
    const slots = await page.locator("article[data-slot-number]").count();
    await expect(sheets).toHaveCount(3 + slots - 1);
    const breaks = await sheets.evaluateAll((elements) =>
      elements.map((e) => getComputedStyle(e).breakBefore),
    );
    expect(breaks.every((value) => value === "page"), breaks.join(", ")).toBe(true);
  });

  test("genera un PDF de varias páginas, sin y con soluciones", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "page.pdf() solo existe en Chromium");
    await openFromMenu(page, title);
    const withoutSolutions = pdfPages(await page.pdf({ preferCSSPageSize: true }));
    expect(withoutSolutions).toBeGreaterThan(1);

    await solutionsCheckbox(page).check();
    const slots = await page.locator("article[data-slot-number]").count();
    const withSolutions = pdfPages(await page.pdf({ preferCSSPageSize: true }));
    expect(withSolutions).toBeGreaterThanOrEqual(withoutSolutions + slots);
  });

  test("axe en la vista de pantalla, con y sin soluciones", async ({ page }) => {
    await openFromMenu(page, title);
    const analyze = async () => (await new AxeBuilder({ page }).analyze()).violations;
    expect(await analyze()).toEqual([]);
    await solutionsCheckbox(page).check();
    await expect(page.getByRole("heading", { level: 2, name: "Soluciones" })).toBeVisible();
    expect(await analyze()).toEqual([]);
  });
});
