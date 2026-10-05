// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Ordenar" (RF-STU-05) over the temporary copy of content/: it lays the diagram out in one edit
// and says what moved, Ctrl+Z and "Deshacer" give the text back byte for byte (the file is "Guardado"
// again), and after saving content:validate passes on the copy. With overlapping sibling groups (a
// fixture copied into the copy) it asks first, naming them. axe on every state.
import { cp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import {
  contentValidate,
  E2E_CONTENT,
  expectNoViolations,
  openScenario,
  saveState,
  scenarioFile,
  SCENARIOS,
} from "./support/studio";

const FIXTURE = {
  id: "overlapping-groups",
  title: "Fixture del Studio: dos grupos hermanos superpuestos",
} as const;

const panel = (page: Page) => page.getByRole("tabpanel", { name: "Diagrama" });
const arrange = (page: Page) => panel(page).getByRole("button", { name: "Ordenar" });
const undoLayout = (page: Page) => panel(page).getByRole("button", { name: "Deshacer el orden" });
const status = (page: Page) => page.locator('[data-slot="diagram-status"]');
const canvas = (page: Page) => page.getByRole("application", { name: "Diagrama del escenario" });

const openDiagram = async (page: Page, title: string) => {
  await openScenario(page, title);
  await page.getByRole("tab", { name: "Diagrama" }).click();
  await expect(canvas(page)).toBeVisible();
};

test("ordena, anuncia, se deshace con Ctrl+Z y con «Deshacer», y guarda un diagrama válido", async ({
  page,
}) => {
  const id = SCENARIOS.site.id;
  const before = await readFile(scenarioFile(id), "utf8");
  await openDiagram(page, SCENARIOS.site.title);

  await test.step("«Ordenar» reubica en una sola edición y lo anuncia", async () => {
    await arrange(page).click();
    await expect(status(page)).toHaveText(/^Se reubicaron \d+ nodos y \d+ grupos?\.$/);
    await expect(undoLayout(page)).toBeVisible();
    await expect(arrange(page)).not.toHaveAttribute("aria-busy");
    await expect(saveState(page)).toHaveAttribute("data-save-state", "dirty");
    await expectNoViolations(page, "Diagrama, después de ordenar");
  });

  await test.step("un Ctrl+Z lo deshace entero: el texto vuelve byte a byte", async () => {
    await canvas(page).focus();
    await page.keyboard.press("Control+z");
    // "Guardado" again: the text is the one on disk.
    await expect(saveState(page)).not.toHaveAttribute("data-save-state", "dirty");
    await expect(undoLayout(page)).toBeHidden();
  });

  await test.step("«Deshacer» también, y el foco vuelve a «Ordenar»", async () => {
    await arrange(page).click();
    await expect(undoLayout(page)).toBeVisible();
    await undoLayout(page).click();
    await expect(status(page)).toHaveText("Se deshizo el orden.");
    await expect(saveState(page)).not.toHaveAttribute("data-save-state", "dirty");
    await expect(arrange(page)).toBeFocused();
  });

  await test.step("ordenar dos veces: la segunda ya está ordenado", async () => {
    await arrange(page).click();
    await expect(status(page)).toHaveText(/^Se reubicaron/);
    await arrange(page).click();
    await expect(status(page)).toHaveText("Ya está ordenado.");
  });

  await test.step("se guarda y content:validate pasa sobre la copia", async () => {
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveState(page)).toHaveText(/^Guardado/);
    const after = await readFile(scenarioFile(id), "utf8");
    expect(after).not.toBe(before);
    const { code, output } = contentValidate();
    expect(code, output).toBe(0);
  });
});

test.describe("con grupos hermanos superpuestos", () => {
  const folder = path.join(E2E_CONTENT, "scenarios", FIXTURE.id);

  test.beforeAll(async () => {
    await cp(
      path.join(import.meta.dirname, "fixtures", FIXTURE.id, "scenario.yaml"),
      path.join(folder, "scenario.yaml"),
    );
  });
  test.afterAll(async () => {
    await rm(folder, { recursive: true, force: true });
  });

  test("pide confirmación nombrando los grupos; cancelar no cambia nada", async ({ page }) => {
    await openDiagram(page, FIXTURE.title);
    const overlapWarning = page
      .getByRole("region", { name: "Validación" })
      .getByText(/se superpone con su grupo hermano/);
    await expect(overlapWarning).toHaveCount(1);

    await arrange(page).click();
    const dialog = page.getByRole("alertdialog", { name: "Hay grupos superpuestos" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Se superponen el grupo «Nube» con «Servicios compartidos».",
    );
    await expectNoViolations(page, "Diagrama, confirmación de grupos superpuestos");

    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
    await expect(arrange(page)).toBeFocused();
    await expect(saveState(page)).not.toHaveAttribute("data-save-state", "dirty");

    await arrange(page).click();
    await dialog.getByRole("button", { name: "Ordenar igual" }).click();
    await expect(status(page)).toHaveText(/^Se reubicaron \d+ nodos y 2 grupos\.$/);
    await expect(saveState(page)).toHaveAttribute("data-save-state", "dirty");
    // The overlap is gone: the panel no longer warns about it.
    await expect(overlapWarning).toHaveCount(0);

    await canvas(page).focus();
    await page.keyboard.press("Control+z");
    await expect(saveState(page)).not.toHaveAttribute("data-save-state", "dirty");
  });
});
