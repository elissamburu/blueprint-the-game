// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Level 0 in the Studio (RF-STU-19, ADR-0027 §6) over the temporary copy of content/, with the
// concepts of the game's e2e appended to its catalog and a level 0 scenario with problems on
// purpose (e2e/fixtures/level-zero): the service picker lists concepts with «Concepto» and finds
// them by plain name; «Dónde se rompe la analogía» is required, with L021 tied to it, and is
// created, filled and removed with the keyboard, each edit one undo step; L005 with a plain name
// and L022 take you to their fields; the preview names the palette «… y conceptos»; and a new
// scenario that becomes level 0 gets «fundamentos». With axe on each screen.
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { palette } from "./support/game";
import {
  E2E_CONTENT,
  editorContent,
  expectNoViolations,
  openScenario,
  REPO_ROOT,
  SCENARIOS,
  saveState,
} from "./support/studio";

const FIXTURE = {
  id: "pizzeria-nivel-0",
  title: "Una pizzería que abre en otra ciudad",
} as const;
const FIXTURES = path.join(import.meta.dirname, "fixtures", "level-zero");
const CATALOG = path.join(E2E_CONTENT, "catalog", "services.yaml");
const FOLDER = path.join(E2E_CONTENT, "scenarios", FIXTURE.id);
/**
 * A level 200 scenario no other spec renames: a copy of the PDF one of the repo (they edit and
 * save the one of the temporary copy).
 */
const LEVEL_200 = {
  id: "comprobantes-nivel-200",
  title: "Comprobantes en PDF, copia de nivel 200",
} as const;
/** The scenario the last test creates, removed afterwards: it does not pass the schema. */
const CREATED = { id: "una-heladeria-de-barrio", title: "Una heladería de barrio" } as const;

const OFFICIAL =
  "https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html";

const formPanel = (page: Page) => page.getByRole("tabpanel", { name: "Formulario" });
const validation = (page: Page) => page.getByRole("region", { name: "Validación" });

const openSection = async (page: Page, name: RegExp | string) => {
  const button = formPanel(page).getByRole("button", { name });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
};

/** The focus ring is visible on the focused element (docs/accesibilidad.md, 2.4.7). */
const expectFocusVisible = async (page: Page) => {
  const outline = await page.evaluate(() => {
    const element = document.activeElement;
    if (element === null) return "none";
    const style = getComputedStyle(element);
    return `${style.outlineStyle} ${style.boxShadow}`;
  });
  expect(outline).not.toBe("none none");
};

let catalog = "";

test.beforeAll(async () => {
  catalog = await readFile(CATALOG, "utf8");
  const concepts = await readFile(path.join(FIXTURES, "concepts.yaml"), "utf8");
  await writeFile(CATALOG, `${catalog}${concepts}`, "utf8");
  await cp(path.join(FIXTURES, "scenario.yaml"), path.join(FOLDER, "scenario.yaml"));
  const pdf = await readFile(
    path.join(REPO_ROOT, "content", "scenarios", SCENARIOS.pdf.id, "scenario.yaml"),
    "utf8",
  );
  await mkdir(path.join(E2E_CONTENT, "scenarios", LEVEL_200.id));
  await writeFile(
    path.join(E2E_CONTENT, "scenarios", LEVEL_200.id, "scenario.yaml"),
    pdf
      .replace(`id: ${SCENARIOS.pdf.id}`, `id: ${LEVEL_200.id}`)
      .replace(`title: "${SCENARIOS.pdf.title}"`, `title: "${LEVEL_200.title}"`),
    "utf8",
  );
});
test.afterAll(async () => {
  await writeFile(CATALOG, catalog, "utf8");
  await rm(FOLDER, { recursive: true, force: true });
  await rm(path.join(E2E_CONTENT, "scenarios", CREATED.id), { recursive: true, force: true });
  await rm(path.join(E2E_CONTENT, "scenarios", LEVEL_200.id), { recursive: true, force: true });
});

test("el selector de servicio muestra los conceptos y busca por nombre simple", async ({
  page,
}) => {
  await openScenario(page, FIXTURE.title);
  await openSection(page, "Casilleros");
  await openSection(page, /^Casillero 1:/);
  const trigger = formPanel(page).getByRole("button", {
    name: "Servicio de la respuesta 1 del casillero 1 Región de AWS (region) · concepto",
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const search = page.getByRole("combobox", { name: "Buscar servicio o concepto" });
  await expect(search).toBeFocused();
  const list = page.getByRole("listbox", { name: "Servicios y conceptos del catálogo" });

  await search.fill("centro de DATOS");
  const zone = list.getByRole("option", {
    name: "Zona de disponibilidad, concepto, Centro de datos aparte (availability-zone)",
  });
  await expect(zone).toBeVisible();
  await expect(zone).toContainText("Concepto");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expectNoViolations(page, "selector de servicio con conceptos");

  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("«Dónde se rompe la analogía»: obligatorio, con L021, y editable con el teclado", async ({
  page,
}) => {
  await openScenario(page, FIXTURE.title);
  const form = formPanel(page);
  const yaml = editorContent(page);

  await test.step("L021 lleva al grupo de la respuesta, que lo tiene asociado", async () => {
    await validation(page).getByRole("button").filter({ hasText: "L021" }).click();
    const group = form.getByRole("group", {
      name: "Dónde se rompe la analogía de la respuesta 1 del casillero 2 (obligatorio en el nivel 0)",
    });
    await expect(group).toBeFocused();
    await expect(group).toHaveAccessibleDescription(/Error L021:/);
    await expectNoViolations(page, "formulario, «Dónde se rompe la analogía» con error L021");
  });

  const add = form.getByRole("button", {
    name: "Agregar «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
  });
  const text = form.getByRole("textbox", {
    name: "Texto de «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
  });
  const reference = form.getByRole("textbox", {
    name: "Referencia 1 de «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
  });

  await test.step("crear, escribir el texto y la referencia, solo con el teclado", async () => {
    await expect(add).toHaveAccessibleDescription(/Error L021:/);
    await page.keyboard.press("Tab");
    await expect(add).toBeFocused();
    await expectFocusVisible(page);
    await page.keyboard.press("Enter");
    await expect(text).toBeFocused();
    await expect(text).toHaveAttribute("aria-required", "true");
    await expect(yaml).toContainText('analogyLimit:            text: ""');

    await page.keyboard.type("Las cocinas se ven desde la calle; las zonas no muestran su lugar.");
    await expect(text).toHaveAccessibleDescription(/^\d+ de 300 caracteres$/);
    await page.keyboard.press("Tab");
    await expect(reference).toBeFocused();
    await expectFocusVisible(page);
    await page.keyboard.type(OFFICIAL);
    await expect(validation(page).getByRole("button").filter({ hasText: "L021" })).toHaveCount(0);
    await expectNoViolations(page, "formulario, «Dónde se rompe la analogía» completo");
  });

  await test.step("una referencia que no es oficial se marca en su campo", async () => {
    await reference.fill("https://example.com/regiones");
    await expect(reference).toHaveAttribute("aria-invalid", "true");
    await expect(reference).toHaveAccessibleDescription(/no es documentación oficial/);
    await form.getByRole("button", { name: /^Agregar referencia de «Dónde se rompe/ }).click();
    const second = form.getByRole("textbox", {
      name: "Referencia 2 de «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
    });
    await expect(second).toBeFocused();
    await form
      .getByRole("button", {
        name: "Quitar la referencia 2 de «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
      })
      .click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Quitar" }).click();
    await expect(second).toHaveCount(0);
    await reference.fill(OFFICIAL);
    await expect(reference).not.toHaveAttribute("aria-invalid");
  });

  await test.step("«Quitar» lo borra entero, en un paso de deshacer", async () => {
    await form
      .getByRole("button", {
        name: "Quitar «Dónde se rompe la analogía» de la respuesta 1 del casillero 2",
      })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("Vaciar el texto no lo quita.");
    await dialog.getByRole("button", { name: "Quitar" }).click();
    await expect(add).toBeFocused();
    await expect(text).toHaveCount(0);

    // The editor draws only the lines in view: the form shows what the YAML has.
    await page.keyboard.press("Control+z");
    await expect(text).toHaveValue(/^Las cocinas se ven/);
    await expect(reference).toHaveValue(OFFICIAL);
  });
});

test("L005 con nombre simple y L022 llevan a su campo; L022 dice que es por PR", async ({
  page,
}) => {
  await openScenario(page, FIXTURE.title);
  const form = formPanel(page);

  const l005 = validation(page).getByRole("button").filter({ hasText: "Lugar del mundo" });
  await l005.click();
  await expect(
    form.getByRole("textbox", { name: "Rol del casillero 1", exact: true }),
  ).toBeFocused();

  const l022 = validation(page)
    .getByRole("button")
    .filter({ hasText: "L022" })
    .filter({ hasText: "(s3)" });
  await expect(l022).toContainText(
    "El Studio no edita el catálogo: el plainName se agrega con un PR que cambie content/catalog/services.yaml.",
  );
  await l022.click();
  const s3 = form.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 3/ });
  await expect(s3).toBeFocused();
  await expect(s3).toHaveAccessibleDescription(/L022:.*El Studio no edita el catálogo/);
});

test("el preview nombra la paleta «Paleta de servicios y conceptos»", async ({ page }) => {
  await openScenario(page, FIXTURE.title);
  await page.getByRole("tab", { name: "Jugar" }).click();
  await page.getByRole("button", { name: "Empezar partida" }).click();
  await page
    .getByRole("dialog", { name: FIXTURE.title })
    .getByRole("button", { name: "Empezar a diseñar" })
    .click();
  await expect(palette(page, "concepts")).toBeVisible();
});

test("en otro nivel, «Dónde se rompe la analogía» es opcional", async ({ page }) => {
  await openScenario(page, LEVEL_200.title);
  await openSection(page, "Casilleros");
  await openSection(page, /^Casillero 1:/);
  const group = formPanel(page).getByRole("group", {
    name: "Dónde se rompe la analogía de la respuesta 1 del casillero 1",
    exact: true,
  });
  await expect(group).toContainText(/Opcional:/);
  await expectNoViolations(page, "formulario, «Dónde se rompe la analogía» vacío");
});

test("un escenario nuevo que pasa a nivel 0 marca «fundamentos», que se puede desmarcar", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Nuevo escenario" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo escenario" });
  await dialog.getByRole("textbox", { name: "Título" }).fill(CREATED.title);
  await dialog.getByRole("button", { name: "Crear y abrir" }).click();
  await expect(editorContent(page)).toBeVisible();
  const form = formPanel(page);

  const level = form.getByRole("combobox", { name: "Nivel" });
  await level.click();
  await page.getByRole("option", { name: "0 · Ideas básicas de la nube" }).click();
  await expect(level).toHaveText("0 · Ideas básicas de la nube");
  await expect(form.getByRole("status")).toHaveText(
    "Se marcó el área «Fundamentos de la nube», la de todo escenario de nivel 0. Podés desmarcarla.",
  );
  const fundamentos = form.getByRole("checkbox", { name: /^fundamentos/ });
  await expect(fundamentos).toBeChecked();
  await expect(editorContent(page)).toContainText("level: 0areas: [fundamentos]");
  await expectNoViolations(page, "formulario, escenario nuevo de nivel 0");

  await fundamentos.click();
  await expect(fundamentos).not.toBeChecked();
  await expect(editorContent(page)).toContainText("level: 0areas: []");
  await expect(saveState(page)).toHaveAttribute("data-save-state", "dirty");
});
