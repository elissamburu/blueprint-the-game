// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The DoD of F2 over the temporary copy of content/: create a scenario from the list without
// touching the YAML (RF-STU-01), writing only its title (the id comes from it), fill it in with the form and the diagram, play it in the preview,
// save it and content:validate passes. Then "Descargar .zip" (RF-STU-14): the files of the zip are
// the ones on disk, and with unsaved changes the zip carries the draft after a warning. axe on the
// dialog and on the editor. Runs after the other specs (it adds a scenario to the copy).
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";
import { board, palette, slot, slotName } from "./support/game";
import {
  contentValidate,
  E2E_AUTHOR,
  editorContent,
  expectNoViolations,
  expectSolidDialog,
  saveState,
  scenarioFile,
  SCENARIOS,
  validationSummary,
} from "./support/studio";

const TITLE = "Miniaturas para las fotos de una tienda";
/** The id the dialog derives from the title. */
const ID = "miniaturas-para-las-fotos-de-una-tienda";
const ROLE = "Genera la miniatura de cada foto que llega.";
const SERVICE = "AWS Lambda";

const formPanel = (page: Page) => page.getByRole("tabpanel", { name: "Formulario" });
const diagramPanel = (page: Page) => page.getByRole("tabpanel", { name: "Diagrama" });
const inspector = (page: Page) => diagramPanel(page).getByRole("region", { name: "Inspector" });
const element = (page: Page, key: string) => page.locator(`[data-diagram-element="${key}"]`);

/** Opens a section of the form (or a slot) by the name of its button. */
const openSection = async (page: Page, name: RegExp | string) => {
  const button = formPanel(page).getByRole("button", { name });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
};

/** The files of a downloaded .zip, by their path inside it. */
const downloadZip = async (page: Page, confirm?: string) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar .zip" }).click();
  if (confirm !== undefined) {
    const dialog = page.getByRole("alertdialog", { name: "¿Descargar el borrador actual?" });
    await expect(dialog).toContainText(confirm);
    await expectSolidDialog(dialog);
    await expectNoViolations(page, "aviso del .zip");
    await dialog.getByRole("button", { name: "Descargar" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Descargar .zip" })).toBeFocused();
  }
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${ID}.zip`);
  const path = await file.path();
  return Object.fromEntries(
    Object.entries(unzipSync(await readFile(path))).map(([name, data]) => [name, strFromU8(data)]),
  );
};

test("crear un escenario sin tocar el YAML, jugarlo, guardarlo y descargarlo", async ({ page }) => {
  await page.goto("/");
  const open = page.getByRole("button", { name: "Nuevo escenario" });
  const dialog = page.getByRole("dialog", { name: "Nuevo escenario" });
  const title = dialog.getByRole("textbox", { name: "Título" });
  const id = dialog.getByRole("textbox", { name: "Id" });

  await test.step("el diálogo: foco en el título, «Cambiar id» valida en vivo y el foco vuelve al cerrar", async () => {
    await open.click();
    await expect(title).toBeFocused();
    await page.keyboard.type("Fotos en Miniatura");
    await expect(dialog.locator("[data-id-preview]")).toHaveText(
      "Se va a crear como content/scenarios/fotos-en-miniatura/",
    );
    await dialog.getByRole("button", { name: "Cambiar id" }).click();
    await expect(id).toBeFocused();
    await expect(id).toHaveValue("fotos-en-miniatura");
    await id.fill("Fotos en Miniatura");
    await expect(id).toHaveAttribute("aria-invalid", "true");
    await expect(id).toHaveAccessibleDescription(/Usá solo minúsculas/);
    await id.fill(SCENARIOS.site.id);
    await expect(id).toHaveAccessibleDescription(/Ya existe un escenario con ese id/);
    await expectNoViolations(page, "diálogo «Nuevo escenario»");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  await test.step("crear vacío escribiendo solo el título: abre el editor con la autora de git", async () => {
    await page.keyboard.press("Enter");
    await expect(title).toBeFocused();
    // Closing forgot the id written by hand: it follows the title again.
    await expect(id).toBeHidden();
    await page.keyboard.type(TITLE);
    await expect(dialog.locator("[data-id-preview]")).toHaveText(
      `Se va a crear como content/scenarios/${ID}/`,
    );
    await expect(dialog.getByRole("radio", { name: "Vacío" })).toBeChecked();
    await dialog.getByRole("button", { name: "Crear y abrir" }).click();
    await expect(page).toHaveURL(new RegExp(`/escenarios/${ID}$`));
    await expect(page.locator("[data-created-notice]")).toContainText(
      `Está en content/scenarios/${ID}/ como borrador.`,
    );
    // The author came from git: the notice does not ask for one.
    await expect(page.locator("[data-created-notice]")).not.toContainText("usuario de GitHub");
    await expect(editorContent(page)).toContainText(`id: ${ID}`);
    await expect(editorContent(page)).toContainText(`github: ${E2E_AUTHOR}`);
    await expect(saveState(page)).toHaveText("Guardado");
    const text = await readFile(scenarioFile(ID), "utf8");
    expect(text).toContain(`title: "${TITLE}"`);
    expect(text).toContain("status: draft");
  });

  await test.step("metadatos, contexto y un objetivo desde el formulario", async () => {
    const form = formPanel(page);
    await openSection(page, "Metadatos");
    await form
      .getByRole("textbox", { name: "Resumen" })
      .fill("Las fotos que suben los clientes necesitan una miniatura al instante.");
    await form
      .getByRole("group", { name: "Áreas" })
      .getByRole("checkbox", { name: /serverless/ })
      .check();
    await openSection(page, "Contexto");
    await form
      .getByRole("textbox", { name: "Contexto" })
      .fill(
        "Una tienda en línea recibe fotos de sus clientes y muestra una miniatura de cada una.",
      );
    await openSection(page, "Objetivos");
    await form.getByRole("button", { name: "Agregar objetivo" }).click();
    await form.getByRole("textbox", { name: "Id del objetivo 1" }).fill("sin-servidores");
    await form
      .getByRole("textbox", { name: "Texto del objetivo 1" })
      .fill("El equipo no quiere administrar servidores.");
  });

  await test.step("un actor y un casillero desde el diagrama, conectados", async () => {
    await page.getByRole("tab", { name: "Diagrama" }).click();
    await diagramPanel(page).getByRole("button", { name: "Agregar Actor" }).click();
    const label = inspector(page).getByRole("textbox", { name: "Etiqueta" });
    await expect(label).toBeFocused();
    await label.fill("Cliente");

    await diagramPanel(page).getByRole("button", { name: "Agregar Casillero" }).click();
    const role = inspector(page).getByRole("textbox", { name: "Rol" });
    await expect(role).toBeFocused();
    await role.fill(ROLE);

    await element(page, "node:nuevo-actor").focus();
    await page.keyboard.press("c");
    const connect = page.getByRole("dialog", { name: "Conectar «Cliente» con…" });
    await expect(connect.getByRole("searchbox", { name: "Buscar" })).toBeFocused();
    await page.keyboard.type("nuevo-slot");
    await page.keyboard.press("Enter");
    await expect(connect).toBeHidden();
    const edgeLabel = inspector(page).getByRole("textbox", { name: "Etiqueta" });
    await expect(edgeLabel).toBeFocused();
    await page.keyboard.type("Sube una foto");
    await expect(editorContent(page)).toContainText("from: nuevo-actor");

    // Both were added in the middle of the view: «Ordenar» spreads them.
    await diagramPanel(page).getByRole("button", { name: "Ordenar" }).click();
    await expect(page.locator('[data-slot="diagram-status"]')).toContainText("Se reubicaron");
  });

  await test.step("la respuesta óptima del casillero en el formulario", async () => {
    await page.getByRole("tab", { name: "Formulario" }).click();
    const form = formPanel(page);
    await openSection(page, "Casilleros");
    await openSection(page, /^Casillero 1:/);
    await form.getByRole("button", { name: "Agregar respuesta" }).click();
    await form.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 1/ }).click();
    await page.getByRole("combobox", { name: "Buscar servicio" }).fill("lambda");
    await page.keyboard.press("Enter");
    await form
      .getByRole("group", { name: "Objetivos vinculados de la respuesta 1 del casillero 1" })
      .getByRole("checkbox", { name: /sin-servidores/ })
      .check();
    await form
      .getByRole("textbox", { name: "Rationale de la respuesta 1 del casillero 1" })
      .fill("Corre el código por cada foto que llega, sin servidores que administrar.");
    await form.getByRole("button", { name: "Agregar referencia" }).click();
    await form
      .getByRole("textbox", { name: /^Referencia 1/ })
      .fill("https://docs.aws.amazon.com/lambda/latest/dg/welcome.html");
    // No errors left, only advice (a level 100 scenario usually has more slots).
    await expect(validationSummary(page)).not.toContainText("error");
  });

  await test.step("jugarlo en el preview hasta el resumen", async () => {
    await page.getByRole("tab", { name: "Jugar" }).click();
    await page.getByRole("button", { name: "Empezar partida" }).click();
    await page
      .getByRole("dialog", { name: TITLE })
      .getByRole("button", { name: "Empezar a diseñar" })
      .click();
    await expect(board(page)).toBeVisible();
    const target = slot(page, ROLE);
    await target.click();
    const search = palette(page).getByRole("searchbox", { name: "Buscar servicio" });
    await expect(search).toBeFocused();
    await page.keyboard.type(SERVICE);
    await page.keyboard.press("Enter");
    await expect(target).toHaveAccessibleName(slotName(1, "Óptimo", SERVICE));
    await page.getByRole("button", { name: "Finalizar" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Partida terminada" })).toBeFocused();
    await expect(page.locator("[data-slot=preview-summary]")).toContainText(SERVICE);
  });

  await test.step("guardar: se generan los archivos y content:validate pasa", async () => {
    await expectNoViolations(page, "editor del escenario nuevo");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(saveState(page)).toHaveText("Guardado. Se regeneraron: diagram.mmd, README.md.");
    const saved = await readFile(scenarioFile(ID), "utf8");
    expect(saved).toMatch(/service: "?lambda"?\n/);
    const validation = contentValidate();
    expect(validation.code, validation.output).toBe(0);
    expect(validation.output).toContain(ID);
  });

  await test.step("descargar el .zip: los archivos del disco", async () => {
    const files = await downloadZip(page);
    expect(Object.keys(files).sort()).toEqual(
      [`${ID}/README.md`, `${ID}/diagram.mmd`, `${ID}/scenario.yaml`].sort(),
    );
    for (const name of ["scenario.yaml", "diagram.mmd", "README.md"]) {
      expect(files[`${ID}/${name}`], name).toBe(await readFile(scenarioFile(ID, name), "utf8"));
    }
    await expect(
      page.getByRole("status").filter({ hasText: `Se descargó ${ID}.zip.` }),
    ).toHaveCount(1);
  });

  await test.step("con cambios sin guardar, el .zip lleva el borrador y lo avisa", async () => {
    await page.getByRole("tab", { name: "Formulario" }).click();
    await formPanel(page).getByRole("textbox", { name: "Título" }).fill(`${TITLE} (v2)`);
    await expect(saveState(page)).toHaveText("Cambios sin guardar");
    const files = await downloadZip(page, "el .zip incluye el borrador actual");
    expect(files[`${ID}/scenario.yaml`]).toContain(`title: "${TITLE} (v2)"`);
    expect(files[`${ID}/README.md`]).toContain(`${TITLE} (v2)`);
    // Nothing was written to disk.
    expect(await readFile(scenarioFile(ID), "utf8")).toContain(`title: "${TITLE}"`);
  });
});
