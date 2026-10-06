// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe on the two pages of the Studio (docs/accesibilidad.md §7): the list and the editor, also
// with findings in the validation panel, and the whole form of the fixture scenarios. It does not
// replace the manual tests of that protocol.
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { FIXTURE_SCENARIO_IDS } from "../shared/testing/fixture-scenarios";
import {
  editorContent,
  expectNoViolations,
  openScenario,
  scenarioFile,
  SCENARIOS,
  validationSummary,
} from "./support/studio";

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
  await page.getByRole("tab", { name: "Jugar" }).click();
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

/** The fixture scenarios in the copy, with their titles as they are now (other specs edit some). */
const scenarios = (): Promise<{ id: string; title: string }[]> =>
  Promise.all(
    FIXTURE_SCENARIO_IDS.map(async (id) => {
      const text = await readFile(scenarioFile(id), "utf8");
      return { id, title: /^title: "(.*)"$/m.exec(text)?.[1] ?? id };
    }),
  );

test("formulario completo de los escenarios de prueba, también con errores", async ({ page }) => {
  test.setTimeout(180_000);
  const all = await scenarios();
  for (const { id, title } of all) {
    await openScenario(page, title);
    const form = page.getByRole("tabpanel", { name: "Formulario" });
    await form.getByRole("button", { name: "Expandir todo" }).click();
    await expect(form.getByRole("button", { name: /^Casillero 1:/ })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await expectNoViolations(page, `formulario de ${id}`);
  }

  // With issues on the fields (aria-invalid and their messages), and read-only.
  const form = page.getByRole("tabpanel", { name: "Formulario" });
  await form.getByRole("textbox", { name: "Título" }).fill("");
  await expect(form.getByRole("textbox", { name: "Título" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expectNoViolations(page, "formulario con errores");
  await editorContent(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nroto: [");
  await expect(form.getByText(/el formulario muestra la última versión válida/)).toBeVisible();
  await expectNoViolations(page, "formulario de solo lectura");
});

test("pestaña «Diagrama»: sin selección, con un nodo, una arista y «Conectar con…»", async ({
  page,
}) => {
  await openScenario(page, SCENARIOS.pdf.title);
  await page.getByRole("tab", { name: "Diagrama" }).click();
  const canvas = page.getByRole("application", { name: "Diagrama del escenario" });
  await expect(canvas).toBeVisible();
  await expectNoViolations(page, "Diagrama, sin selección");

  await canvas.locator('[data-diagram-element="node:api-entry"]').click();
  await expect(page.getByRole("heading", { name: /^Casillero 1 · api-entry$/ })).toBeVisible();
  await expectNoViolations(page, "Diagrama, con un nodo");

  await page.keyboard.press("c");
  await expect(page.getByRole("dialog", { name: /^Conectar/ })).toBeVisible();
  await expectNoViolations(page, "Diagrama, «Conectar con…»");
  await page.keyboard.press("Escape");

  await canvas.locator('[data-diagram-element^="edge:"]').first().click();
  await expect(page.getByRole("heading", { name: /^Arista · / })).toBeVisible();
  await expectNoViolations(page, "Diagrama, con una arista");
});
