// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The form of the Studio (RF-STU-03, 06, 07) over the temporary copy of content/: edit the title
// and a rationale and see them in the YAML, add an objective and link it to an answer, cause a
// lint error and reach its field from the validation panel, undo, save and content:validate
// passes on the copy. Plus the same kind of editing with the keyboard only.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { tabTo } from "./support/game";
import {
  contentValidate,
  editorContent,
  openScenario,
  saveState,
  scenarioFile,
  validationSummary,
} from "./support/studio";

const K8S = {
  id: "kubernetes-api-migration",
  title: "Migrar una API de pagos en Kubernetes sin reescribir sus charts",
} as const;
const VPC = {
  id: "private-vpc-service-access",
  title: "Una aplicación en subredes privadas que no puede salir a internet",
} as const;

const formPanel = (page: Page) => page.getByRole("tabpanel", { name: "Formulario" });
const formStatus = (page: Page) => formPanel(page).getByRole("status");

/** Opens a section of the form (or a slot) by the name of its button. */
const openSection = async (page: Page, name: RegExp | string) => {
  const button = formPanel(page).getByRole("button", { name });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
};

test("editar desde el formulario, vincular, saltar al error, deshacer y guardar", async ({
  page,
}) => {
  const before = await readFile(scenarioFile(K8S.id), "utf8");
  await openScenario(page, K8S.title);
  await expect(page.getByRole("tab", { name: "Formulario" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const okSummary = await validationSummary(page).innerText();
  const form = formPanel(page);

  await test.step("el título y una rationale, en el YAML", async () => {
    const title = form.getByRole("textbox", { name: "Título" });
    await expect(title).toHaveValue(K8S.title);
    await title.fill(`${K8S.title} (v2)`);
    await expect(editorContent(page)).toContainText(`title: "${K8S.title} (v2)"`);
    await expect(saveState(page)).toHaveText("Cambios sin guardar");

    await openSection(page, "Casilleros");
    await openSection(page, /^Casillero 1:/);
    const rationale = form.getByRole("textbox", {
      name: "Rationale de la respuesta 1 del casillero 1",
    });
    await rationale.fill("Una explicación nueva escrita desde el formulario.\n");
    await expect(editorContent(page)).toContainText(
      "Una explicación nueva escrita desde el formulario.",
    );
  });

  await test.step("agregar un objetivo y vincularlo a una respuesta", async () => {
    await openSection(page, "Objetivos");
    await form.getByRole("button", { name: "Agregar objetivo" }).click();
    await expect(formStatus(page)).toHaveText("Se agregó el objetivo 7.");
    const id = form.getByRole("textbox", { name: "Id del objetivo 7" });
    await expect(id).toBeFocused();
    await id.fill("audit-trail");
    await form
      .getByRole("textbox", { name: "Texto del objetivo 7" })
      .fill("Auditoría registra cada acceso a la base.");

    const linked = form.getByRole("group", {
      name: "Objetivos vinculados de la respuesta 1 del casillero 1",
    });
    await linked.getByRole("checkbox", { name: /audit-trail/ }).check();
    await expect(editorContent(page)).toContainText(
      "objectives: [keep-kubernetes, no-control-plane, audit-trail]",
    );
    await expect(validationSummary(page)).toHaveText(okSummary);
  });

  await test.step("un error de lint lleva a su campo", async () => {
    const title = form.getByRole("textbox", { name: "Título" });
    await title.fill(`${K8S.title} en EKS`);
    const issue = page
      .getByRole("region", { name: "Validación" })
      .getByRole("button", { name: /L005/ })
      .first();
    await expect(issue).toBeVisible();
    // Close the metadata so the jump has to open it.
    await form.getByRole("button", { name: "Contraer todo" }).click();
    await issue.click();
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription(/L005/);
  });

  await test.step("Ctrl+Z en el formulario deshace el último cambio", async () => {
    await page.keyboard.press("Control+z");
    const title = form.getByRole("textbox", { name: "Título" });
    await expect(title).toHaveValue(`${K8S.title} (v2)`);
    await expect(editorContent(page)).toContainText(`title: "${K8S.title} (v2)"`);
    await expect(validationSummary(page)).toHaveText(okSummary);
    await expect(title).not.toHaveAttribute("aria-invalid");
  });

  await test.step("guardar: solo cambian esas líneas y content:validate pasa", async () => {
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveState(page)).toHaveText(/^Guardado/);
    const after = await readFile(scenarioFile(K8S.id), "utf8");
    expect(after).toContain(`title: "${K8S.title} (v2)"`);
    expect(after).toContain("  - id: audit-trail\n");
    // Every comment of the file is still there.
    const comments = (text: string) => text.split("\n").filter((line) => line.includes("#"));
    expect(comments(after)).toEqual(comments(before));
    const validation = contentValidate();
    expect(validation.code, validation.output).toBe(0);
  });
});

test("con teclado: agregar, mover, quitar, elegir un servicio y deshacer", async ({ page }) => {
  const before = await readFile(scenarioFile(VPC.id), "utf8");
  await openScenario(page, VPC.title);
  const form = formPanel(page);
  await page.getByRole("tab", { name: "Formulario" }).focus();

  const objectives = form.getByRole("button", { name: "Objetivos", exact: true });
  await tabTo(page, objectives, "la sección «Objetivos»");
  await page.keyboard.press("Enter");
  await expect(objectives).toHaveAttribute("aria-expanded", "true");
  const count = await form.getByRole("group", { name: /^Objetivo \d+$/ }).count();

  await tabTo(page, form.getByRole("button", { name: "Agregar objetivo" }), "«Agregar objetivo»");
  await page.keyboard.press("Enter");
  const added = count + 1;
  await expect(form.getByRole("textbox", { name: `Id del objetivo ${added}` })).toBeFocused();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("con-teclado");

  const up = form.getByRole("button", { name: `Subir el objetivo ${added}` });
  // The actions of an item are in its header, before its fields.
  await tabTo(page, up, "«Subir»", "Shift+Tab");
  await page.keyboard.press("Enter");
  await expect(formStatus(page)).toHaveText(
    `el objetivo ${added}: ahora en la posición ${count} de ${added}.`,
  );
  await expect(form.getByRole("button", { name: `Subir el objetivo ${count}` })).toBeFocused();
  await expect(form.getByRole("textbox", { name: `Id del objetivo ${count}` })).toHaveValue(
    "con-teclado",
  );

  const remove = form.getByRole("button", { name: `Quitar el objetivo ${count}` });
  await tabTo(page, remove, "«Quitar»");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("alertdialog", { name: `¿Quitar el objetivo ${count}?` });
  await expect(dialog).toBeVisible();
  await tabTo(page, dialog.getByRole("button", { name: "Quitar" }), "«Quitar» del diálogo");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(formStatus(page)).toHaveText(`Se quitó el objetivo ${count}.`);
  await expect(form.getByRole("button", { name: "Agregar objetivo" })).toBeFocused();
  await expect(form.getByRole("group", { name: /^Objetivo \d+$/ })).toHaveCount(count);

  await tabTo(page, form.getByRole("button", { name: "Casilleros" }), "«Casilleros»");
  await page.keyboard.press("Enter");
  const firstSlot = form.getByRole("button", { name: /^Casillero 1:/ });
  await tabTo(page, firstSlot, "el casillero 1");
  await page.keyboard.press("Enter");
  const service = form.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 1/ });
  await tabTo(page, service, "el servicio de la respuesta 1");
  const original = await service.innerText();
  await page.keyboard.press("Enter");
  const search = page.getByRole("combobox", { name: "Buscar servicio" });
  await expect(search).toBeFocused();
  await page.keyboard.type("lambda");
  await page.keyboard.press("Enter");
  await expect(service).toBeFocused();
  await expect(service).toContainText("(lambda)");

  // Undo the four changes, newest first, until the file is as it was.
  for (let undo = 0; undo < 6 && (await saveState(page).innerText()) !== "Guardado"; undo++) {
    await page.keyboard.press("Control+z");
  }
  await expect(saveState(page)).toHaveText("Guardado");
  await expect(service).toHaveText(original);
  expect(await readFile(scenarioFile(VPC.id), "utf8")).toBe(before);
});
