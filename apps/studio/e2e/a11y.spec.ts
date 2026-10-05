// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe on the two pages of the Studio (docs/accesibilidad.md §7): the list and the editor, also
// with findings in the validation panel. It does not replace the manual tests of that protocol.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { editorContent, openScenario, SCENARIOS, validationSummary } from "./support/studio";

const expectNoViolations = async (page: Page, screen: string) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact ?? "?"}) en ${node.target.join(" ")}: ${node.failureSummary ?? violation.help}`,
    ),
  );
  expect.soft(found, `axe en «${screen}»`).toEqual([]);
};

test("listado", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  await expect(page.getByRole("link", { name: SCENARIOS.site.title })).toBeVisible();
  await expectNoViolations(page, "listado");
});

test("editor, sin errores y con errores", async ({ page }) => {
  await openScenario(page, SCENARIOS.site.title);
  await expectNoViolations(page, "editor");

  await editorContent(page).click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("level: 250\n");
  await expect(validationSummary(page)).toContainText("error");
  await expectNoViolations(page, "editor con errores");
  await page.keyboard.press("Control+z");
});

test("pestañas «Jugar» y «Respuestas», también en partida y con el resumen", async ({ page }) => {
  await openScenario(page, SCENARIOS.pdf.title);
  await expectNoViolations(page, "Jugar, sin partida");

  await page.getByRole("button", { name: "Empezar partida" }).click();
  const brief = page.getByRole("dialog", { name: SCENARIOS.pdf.title });
  await expect(brief).toBeVisible();
  await expectNoViolations(page, "Jugar, brief");
  await brief.getByRole("button", { name: "Empezar a diseñar" }).click();
  await expect(brief).toBeHidden();
  await expectNoViolations(page, "Jugar, en partida");

  await page.getByRole("button", { name: "Más acciones" }).click();
  await page.getByRole("menuitem", { name: "Ver solución completa" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: /Ver solución/ })
    .click();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Partida terminada" })).toBeVisible();
  await expectNoViolations(page, "Jugar, resumen");

  await page.getByRole("tab", { name: "Respuestas" }).click();
  await expect(
    page.getByRole("heading", { level: 2, name: "Respuestas del borrador" }),
  ).toBeVisible();
  await expectNoViolations(page, "Respuestas");
});
