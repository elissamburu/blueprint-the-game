// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The visual editor of the diagram (RF-STU-04) over the temporary copy of content/: with the
// keyboard only (Tab through the elements, arrows, "Conectar con…", Supr with confirmation, Esc and
// Tab to leave, Ctrl+Z) and with the pointer (drag a node into a group, add from the palette).
// Every change is in the YAML, and after saving content:validate passes on the copy.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { tabTo } from "./support/game";
import { contentValidate, openScenario, saveState, scenarioFile } from "./support/studio";

const GPU = {
  id: "gpu-inference-on-eks",
  title: "Un modelo propio con GPU en la plataforma Kubernetes de la empresa",
} as const;

const panel = (page: Page) => page.getByRole("tabpanel", { name: "Diagrama" });
const canvas = (page: Page) => page.getByRole("application", { name: "Diagrama del escenario" });
const element = (page: Page, key: string) => page.locator(`[data-diagram-element="${key}"]`);
const inspector = (page: Page) => panel(page).getByRole("region", { name: "Inspector" });
const status = (page: Page) => page.locator('[data-slot="diagram-status"]');

test("con teclado: recorrer, mover, conectar, eliminar, salir y guardar", async ({ page }) => {
  const before = await readFile(scenarioFile(GPU.id), "utf8");
  await openScenario(page, GPU.title);
  await page.getByRole("tab", { name: "Formulario" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Diagrama" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(panel(page).getByText(/Esc y después Tab/)).toBeVisible();

  await test.step("Tab entra al diagrama y recorre sus elementos", async () => {
    await tabTo(page, canvas(page), "el diagrama");
    await page.keyboard.press("Tab");
    // Reading order: the region (top left) first.
    await expect(element(page, "group:region")).toBeFocused();
    await tabTo(page, element(page, "node:data-team"), "el equipo de datos");
  });

  await test.step("las flechas mueven de a 10 y con Mayús de a 1", async () => {
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Shift+ArrowRight");
    await expect(status(page)).toHaveText("El actor «Equipo de datos» queda en x 41, y 140.");
    await expect(inspector(page).getByRole("textbox", { name: "X", exact: true })).toHaveValue(
      "41",
    );
    await expect(inspector(page).getByRole("textbox", { name: "Y", exact: true })).toHaveValue(
      "140",
    );
  });

  await test.step("«Conectar con…» sin arrastrar, y la etiqueta en el inspector", async () => {
    await page.keyboard.press("c");
    const dialog = page.getByRole("dialog", { name: "Conectar «Equipo de datos» con…" });
    await expect(dialog.getByRole("searchbox", { name: "Buscar" })).toBeFocused();
    await page.keyboard.type("registry");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    const label = inspector(page).getByRole("textbox", { name: "Etiqueta" });
    await expect(label).toBeFocused();
    await page.keyboard.type("Consulta las imágenes");
    await expect(
      inspector(page).getByRole("heading", { name: "Arista · nueva-arista" }),
    ).toBeVisible();
    await expect(inspector(page).getByRole("combobox", { name: "Hacia" })).toHaveText(/(registry)/);
    await expect(element(page, "edge:nueva-arista")).toHaveAttribute(
      "aria-label",
      /^Arista, paso \d+: de Equipo de datos a Amazon ECR, «Consulta las imágenes»$/,
    );
  });

  await test.step("Supr pide confirmación y Ctrl+Z lo deshace", async () => {
    await element(page, "node:gitops").focus();
    await page.keyboard.press("Delete");
    const confirm = page.getByRole("alertdialog", {
      name: "¿Eliminar el sistema externo «Repositorio GitOps»?",
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Eliminar" }).focus();
    await page.keyboard.press("Enter");
    await expect(element(page, "node:gitops")).toHaveCount(0);
    await expect(element(page, "edge:e2")).toHaveCount(0);
    await expect(canvas(page)).toBeFocused();
    await page.keyboard.press("Control+z");
    await expect(element(page, "node:gitops")).toHaveCount(1);
    await expect(element(page, "edge:e2")).toHaveCount(1);
  });

  await test.step("Esc y después Tab salen del diagrama", async () => {
    await page.keyboard.press("Tab");
    await expect(element(page, "group:region")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(canvas(page)).toBeFocused();
    await page.keyboard.press("Tab");
    const inside = await canvas(page).evaluate((node) => node.contains(document.activeElement));
    expect(inside).toBe(false);
  });

  await test.step("guardar: content:validate pasa y los comentarios siguen", async () => {
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveState(page)).toHaveText(/^Guardado/);
    const after = await readFile(scenarioFile(GPU.id), "utf8");
    expect(after).toContain("position: { x: 41, y: 140 }");
    expect(after).toContain("Consulta las imágenes");
    expect(after).toContain("id: gitops");
    const comments = (text: string) => text.split("\n").filter((line) => line.includes("#"));
    expect(comments(after)).toEqual(comments(before));
    const validation = contentValidate();
    expect(validation.code, validation.output).toBe(0);
  });
});

test("con mouse: arrastrar un nodo a un grupo y agregar desde la paleta", async ({ page }) => {
  await openScenario(page, GPU.title);
  await page.getByRole("tab", { name: "Diagrama" }).click();

  await test.step("arrastrar un actor adentro de la región", async () => {
    const box = await element(page, "node:consumers").boundingBox();
    const region = await element(page, "group:region").boundingBox();
    if (box === null || region === null) throw new Error("sin cajas");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    // To the free space at the bottom left of the region, in small steps (as a hand).
    await page.mouse.move(region.x + box.width, box.y + box.height * 2.6, { steps: 12 });
    await page.mouse.up();
    await expect(status(page)).toContainText("Ahora está en Región.");
    await expect(inspector(page).getByRole("heading", { name: "Actor · consumers" })).toBeVisible();
    await expect(inspector(page).getByRole("combobox", { name: "Grupo" })).toHaveText(
      /Región \(region\)/,
    );
  });

  await test.step("agregar un casillero desde la paleta", async () => {
    await panel(page).getByRole("button", { name: "Agregar Casillero" }).click();
    await expect(element(page, "node:nuevo-slot")).toHaveAttribute("aria-label", /Incompleto$/);
    const role = inspector(page).getByRole("textbox", { name: "Rol" });
    await expect(role).toBeFocused();
    await role.fill("Guarda los resultados de cada reclamo.");
    await expect(element(page, "node:nuevo-slot")).toHaveAttribute(
      "aria-label",
      /^Casillero 7: Guarda los resultados de cada reclamo./,
    );
  });

  await test.step("Ctrl+Z deshace el casillero y el arrastre", async () => {
    await element(page, "node:nuevo-slot").focus();
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await page.keyboard.press("Control+z");
    await expect(element(page, "node:nuevo-slot")).toHaveCount(0);
    // The focus of the removed node goes back to the canvas, where Ctrl+Z still works.
    await expect(canvas(page)).toBeFocused();
    await expect(element(page, "node:consumers")).toHaveAttribute(
      "aria-label",
      /sin grupo, x 40, y 520$/,
    );
  });
});
