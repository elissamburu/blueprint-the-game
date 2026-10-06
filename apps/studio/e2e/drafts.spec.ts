// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Drafts that fail the schema (ADR-0025, S10 as amended on 2026-10-05): a new empty scenario is
// saved with "Guardar borrador", says that diagram.mmd and README.md were not regenerated, and the
// saved text is there after reloading. A scenario that is not a draft still cannot be saved with a
// schema error. The unsaved text is copied to the browser and offered back after a reload.
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

test.describe("copia local de los cambios sin guardar", () => {
  const MARK = "# cambio sin guardar";
  const hasLocalCopy = (page: Page, id: string) =>
    page.waitForFunction(
      (key) => window.localStorage.getItem(key) !== null,
      `blueprint-studio:draft:${id}`,
    );
  const reloadAnyway = async (page: Page) => {
    // The browser asks before reloading with unsaved changes.
    page.once("dialog", (dialog) => void dialog.accept());
    await page.reload();
    await expect(editorContent(page)).toBeVisible();
  };

  test("editar sin guardar, recargar y recuperar", async ({ page }) => {
    const { id, title } = SCENARIOS.pdf;
    const before = await readFile(scenarioFile(id), "utf8");
    await openScenario(page, title);
    await editorContent(page).click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type(`${MARK}\n`);
    await expect(saveState(page)).toHaveText("Cambios sin guardar");
    await hasLocalCopy(page, id);

    await reloadAnyway(page);
    const notice = page.locator("[data-recovery-notice]");
    await expect(notice).toContainText("Hay cambios sin guardar de una sesión anterior");
    // Until the author decides, the editor shows the file.
    await expect(editorContent(page)).not.toContainText(MARK);
    await expectNoViolations(page, "editor con una copia local para recuperar");

    await notice.getByRole("button", { name: "Recuperar los cambios sin guardar" }).click();
    await expect(notice).toBeHidden();
    await expect(editorContent(page)).toContainText(MARK);
    await expect(saveState(page)).toHaveText("Cambios sin guardar");
    // Nothing reached the file: the copy lives only in the browser.
    expect(await readFile(scenarioFile(id), "utf8")).toBe(before);

    // Saving removes the copy: reloading offers nothing.
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(saveState(page)).toHaveText(/^Guardado/);
    expect(await readFile(scenarioFile(id), "utf8")).toBe(`${MARK}\n${before}`);
    await page.reload();
    await expect(editorContent(page)).toContainText(MARK);
    await expect(notice).toHaveCount(0);
  });

  test("descartar la copia deja el archivo como está", async ({ page }) => {
    const { id, title } = SCENARIOS.eks;
    await openScenario(page, title);
    await editorContent(page).click();
    await page.keyboard.press("Control+Home");
    await page.keyboard.type(`${MARK}\n`);
    await hasLocalCopy(page, id);

    await reloadAnyway(page);
    const notice = page.locator("[data-recovery-notice]");
    await notice.getByRole("button", { name: "Descartar" }).click();
    await expect(notice).toBeHidden();
    await expect(editorContent(page)).not.toContainText(MARK);
    await expect(saveState(page)).toHaveText("Guardado");
    await page.reload();
    await expect(editorContent(page)).toBeVisible();
    await expect(notice).toHaveCount(0);
  });
});
