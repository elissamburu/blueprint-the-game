// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Editing journey of the Studio over a temporary copy of content/: open, break the YAML, see the
// error and jump to its line, fix it, save, and content:validate passes on the copy. Plus the 409
// when the file changes on disk in the middle of the edit, and the warning before leaving.
import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  contentValidate,
  cursorLine,
  editorContent,
  expectSolidDialog,
  openScenario,
  saveState,
  scenarioFile,
  SCENARIOS,
  validationSummary,
} from "./support/studio";

test("abrir, romper el YAML, saltar al error, corregir, guardar y validar", async ({ page }) => {
  const { id, title } = SCENARIOS.site;
  const before = await readFile(scenarioFile(id), "utf8");
  await openScenario(page, title);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  await expect(saveState(page)).toHaveText("Guardado");
  const okSummary = await validationSummary(page).innerText();
  expect(okSummary).not.toMatch(/^\d+ error/);

  // Break the YAML at the end of the file, then leave the cursor at the start.
  await editorContent(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.type("roto: [sin cerrar");
  const brokenLine = await cursorLine(page);
  await page.keyboard.press("Control+Home");
  expect(await cursorLine(page)).toBe(1);
  await expect(saveState(page)).toHaveText("Cambios sin guardar");

  await expect(validationSummary(page)).toHaveText("1 error");
  const issue = page
    .getByRole("region", { name: "Validación" })
    .getByRole("button", { name: /YAML inválido/ });
  await expect(issue).toContainText("Error");
  await expect(issue).toContainText(`Línea ${brokenLine}`);

  await issue.click();
  await expect(editorContent(page)).toBeFocused();
  expect(await cursorLine(page)).toBe(brokenLine);

  // Fix it: delete the broken line.
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Home");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Backspace");
  await expect(validationSummary(page)).toHaveText(okSummary);

  // A visible change, then save with the button.
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("# Revisado en el Studio\n");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(saveState(page)).toHaveText("Guardado");

  const after = await readFile(scenarioFile(id), "utf8");
  expect(after).toBe(`# Revisado en el Studio\n${before}`);
  const validation = contentValidate();
  expect(validation.code, validation.output).toBe(0);
});

test("Ctrl+S guarda y los archivos generados quedan al día", async ({ page }) => {
  const { id, title } = SCENARIOS.pdf;
  await openScenario(page, title);
  const yaml = await readFile(scenarioFile(id), "utf8");
  const line = yaml.split("\n").findIndex((l) => l.startsWith("title:")) + 1;
  const issueFree = await validationSummary(page).innerText();

  await editorContent(page).click();
  await page.keyboard.press("Control+Home");
  for (let i = 1; i < line; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(" (revisado)");
  await expect(validationSummary(page)).toHaveText(issueFree);
  await page.keyboard.press("Control+s");
  await expect(saveState(page)).toHaveText("Guardado. Se regeneraron: README.md.");

  expect(await readFile(scenarioFile(id, "README.md"), "utf8")).toContain("(revisado)");
  const validation = contentValidate();
  expect(validation.code, validation.output).toBe(0);
});

test("409: el archivo cambió en disco a mitad de la edición", async ({ page }) => {
  const { id, title } = SCENARIOS.eks;
  await openScenario(page, title);

  await editorContent(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n# mi cambio");
  await expect(saveState(page)).toHaveText("Cambios sin guardar");

  // Someone edits the file outside the Studio.
  const external = `${await readFile(scenarioFile(id), "utf8")}# cambio de afuera\n`;
  await writeFile(scenarioFile(id), external, "utf8");

  await page.getByRole("button", { name: "Guardar" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "El archivo cambió en disco" });
  await expect(alert).toBeVisible();
  await expect(saveState(page)).toHaveText("No se guardó: el archivo cambió en disco");
  // Never overwritten.
  expect(await readFile(scenarioFile(id), "utf8")).toBe(external);

  await alert.getByRole("button", { name: "Recargar desde el disco" }).click();
  await expect(alert).toBeHidden();
  await expect(saveState(page)).toHaveText("Guardado");
  // CodeMirror only renders the visible lines: go to the end first.
  await editorContent(page).click();
  await page.keyboard.press("Control+End");
  await expect(editorContent(page)).toContainText("# cambio de afuera");
  await expect(editorContent(page)).not.toContainText("# mi cambio");
});

test("avisa antes de salir con cambios sin guardar", async ({ page }) => {
  await openScenario(page, SCENARIOS.site.title);
  await editorContent(page).click();
  await page.keyboard.type("# borrador\n");

  await page.getByRole("link", { name: "Escenarios" }).click();
  const dialog = page.getByRole("alertdialog", { name: "¿Salir sin guardar?" });
  await expectSolidDialog(dialog);
  await dialog.getByRole("button", { name: "Seguir editando" }).click();
  await expect(dialog).toBeHidden();
  await expect(editorContent(page)).toContainText("# borrador");

  await page.getByRole("link", { name: "Escenarios" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Salir sin guardar" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
});

test("teclado: Tab indenta dentro del editor y Esc + Tab sale", async ({ page }) => {
  await openScenario(page, SCENARIOS.site.title);
  await expect(
    page.getByText("Tab indenta. Para salir del editor con el teclado: Esc y después Tab"),
  ).toBeVisible();
  await editorContent(page).click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Tab");
  await expect(editorContent(page)).toBeFocused();
  await expect(saveState(page)).toHaveText("Cambios sin guardar");

  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await expect(editorContent(page)).not.toBeFocused();
  // Undo the indentation so the scenario stays as it was.
  await editorContent(page).click();
  await page.keyboard.press("Control+z");
  await expect(saveState(page)).toHaveText("Guardado");
});
