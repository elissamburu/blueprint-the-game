// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Drafts that fail the schema (ADR-0025, S10 as amended on 2026-10-05): a new empty scenario is
// saved with "Guardar borrador", says that diagram.mmd and README.md were not regenerated, and the
// saved text is there after reloading. A scenario that is not a draft still cannot be saved with a
// schema error.
import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  E2E_CONTENT,
  editorContent,
  expectNoViolations,
  openScenario,
  saveState,
  scenarioFile,
  SCENARIOS,
  validationSummary,
} from "./support/studio";

const DRAFT = { id: "borrador-a-medias", title: "Borrador a medias" } as const;
const SUMMARY = "Un resumen escrito antes de completar el resto del escenario.";

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

const createEmpty = async (page: Page, title: string) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo escenario" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo escenario" });
  await dialog.getByRole("textbox", { name: "Título" }).fill(title);
  await dialog.getByRole("button", { name: "Crear y abrir" }).click();
  await expect(editorContent(page)).toBeVisible();
  await expect(validationSummary(page)).not.toBeEmpty();
};

test.afterAll(async () => {
  await rm(path.join(E2E_CONTENT, "scenarios", DRAFT.id), { recursive: true, force: true });
});

test("guardar un borrador con errores, recargar y ver lo guardado", async ({ page }) => {
  await createEmpty(page, DRAFT.title);
  await expect(validationSummary(page)).toContainText("error");

  const form = page.getByRole("tabpanel", { name: "Formulario" });
  await form.getByRole("textbox", { name: "Resumen" }).fill(SUMMARY);
  const save = page.getByRole("button", { name: "Guardar borrador" });
  await expect(save).toBeVisible();
  await expectNoViolations(page, "editor de un borrador con errores");

  await save.click();
  await expect(saveState(page)).toHaveText(
    /^Guardado con \d+ errores?: diagram\.mmd y README\.md sin regenerar$/,
  );
  // Nothing was generated: the scenario does not pass the schema.
  expect(await exists(scenarioFile(DRAFT.id, "diagram.mmd"))).toBe(false);
  expect(await exists(scenarioFile(DRAFT.id, "README.md"))).toBe(false);

  await page.reload();
  await expect(editorContent(page)).toContainText(`summary: "${SUMMARY}"`);
  await expect(form.getByRole("textbox", { name: "Resumen" })).toHaveValue(SUMMARY);
  await expect(saveState(page)).toHaveText("Guardado");
});

test("un escenario que no es borrador no se guarda con un error de schema", async ({ page }) => {
  const before = await readFile(scenarioFile(SCENARIOS.site.id), "utf8");
  await openScenario(page, SCENARIOS.site.title);
  const form = page.getByRole("tabpanel", { name: "Formulario" });
  await form.getByRole("textbox", { name: "Título" }).fill("");
  await expect(validationSummary(page)).toContainText("error");
  // Not a draft: the button does not offer to save it as one.
  await expect(page.getByRole("button", { name: "Guardar borrador" })).toHaveCount(0);
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(saveState(page)).toHaveText("No se guardó");
  await expect(page.getByRole("alert")).toContainText("title");
  expect(await readFile(scenarioFile(SCENARIOS.site.id), "utf8")).toBe(before);
});
