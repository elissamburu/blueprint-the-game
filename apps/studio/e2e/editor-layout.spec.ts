// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Layout of the editor at 1920×1080 and 1280×720: an edit from the form never leaves the YAML
// scrolled sideways (the lines wrap), the panels take the height of the window with no empty space
// under them and without overlapping, and the message of a field is seen whole, not cut by the
// form's scroll container.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { editorContent, expectNoViolations, openScenario, SCENARIOS } from "./support/studio";

/** p-4 of the panels' grid. */
const PADDING = 16;

const LONG_SUMMARY =
  "Una ONG publica su sitio institucional con HTTPS y quiere que cargue rápido en todo el mundo, con costos bajos y sin servidores que mantener";

const box = async (locator: Locator) => {
  const found = await locator.boundingBox();
  if (found === null) throw new Error("Not visible");
  return found;
};

/** The whole box of `inner` is inside the visible box of `outer`. */
const expectInside = async (inner: Locator, outer: Locator) => {
  const a = await box(inner);
  const b = await box(outer);
  expect(a.y, "top").toBeGreaterThanOrEqual(b.y - 1);
  expect(a.y + a.height, "bottom").toBeLessThanOrEqual(b.y + b.height + 1);
  expect(a.x, "left").toBeGreaterThanOrEqual(b.x - 1);
  expect(a.x + a.width, "right").toBeLessThanOrEqual(b.x + b.width + 1);
};

const form = (page: Page) => page.getByRole("tabpanel", { name: "Formulario" });
const validation = (page: Page) => page.getByRole("region", { name: "Validación" });

for (const size of [
  { width: 1920, height: 1080 },
  { width: 1280, height: 720 },
]) {
  test.describe(`${size.width}×${size.height}`, () => {
    test.use({ viewport: size });

    test("editar un texto largo desde el formulario no corre el YAML a los costados", async ({
      page,
    }) => {
      await openScenario(page, SCENARIOS.site.title);
      const summary = form(page).getByRole("textbox", { name: "Resumen" });
      await summary.fill(LONG_SUMMARY);
      // Typing at the end of the long line: each keystroke is an edit of the form.
      await summary.press("End");
      await summary.pressSequentially(" y más", { delay: 20 });
      await expect(editorContent(page)).toContainText("y más");
      const scroller = page.locator(".cm-scroller");
      expect(await scroller.evaluate((element) => element.scrollLeft)).toBe(0);
      expect(
        await scroller.evaluate((element) => element.scrollWidth - element.clientWidth),
      ).toBeLessThanOrEqual(0);
    });

    test("los paneles ocupan la altura de la ventana, sin espacio vacío ni superposiciones", async ({
      page,
    }) => {
      await openScenario(page, SCENARIOS.site.title);
      const bottom = size.height - PADDING;
      const formBox = await box(form(page));
      const validationBox = await box(validation(page));
      expect(formBox.y + formBox.height).toBeGreaterThanOrEqual(bottom - 2);
      expect(formBox.y + formBox.height).toBeLessThanOrEqual(bottom + 1);
      expect(validationBox.y + validationBox.height).toBeGreaterThanOrEqual(bottom - 2);
      expect(validationBox.y + validationBox.height).toBeLessThanOrEqual(bottom + 1);
      // No empty space inside the validation panel either: it is as tall as what it shows, and
      // the YAML takes the rest.
      const contentBottom = await validation(page).evaluate((section) =>
        Math.max(...[...section.children].map((child) => child.getBoundingClientRect().bottom)),
      );
      expect(validationBox.y + validationBox.height - contentBottom).toBeLessThanOrEqual(2);
      // The YAML ends above the validation panel, whose heading and summary are visible.
      const yaml = await box(page.locator(".cm-editor"));
      expect(yaml.y + yaml.height).toBeLessThanOrEqual(validationBox.y);
      await expect(validation(page).getByRole("heading", { name: "Validación" })).toBeInViewport({
        ratio: 1,
      });
      // With many findings, the panel grows up to its limit and its list scrolls.
      await form(page).getByRole("textbox", { name: "Título" }).fill("");
      await form(page).getByRole("textbox", { name: "Resumen" }).fill("");
      await form(page)
        .getByRole("textbox", { name: /^Autor 1/ })
        .fill("");
      await expect(validation(page).getByRole("button")).not.toHaveCount(0);
      const withFindings = await box(validation(page));
      expect(withFindings.y + withFindings.height).toBeLessThanOrEqual(bottom + 1);
      const editorBox = await box(page.locator(".cm-editor"));
      expect(editorBox.height).toBeGreaterThanOrEqual(size.height / 4);
      await expectNoViolations(page, `editor a ${size.width}×${size.height}`);
    });

    test("el mensaje de error de un campo se ve completo", async ({ page }) => {
      await openScenario(page, SCENARIOS.site.title);
      const panel = form(page);
      const summary = panel.getByRole("textbox", { name: "Resumen" });
      // The field at the bottom edge of the form's scroll container.
      await summary.evaluate((element) => element.scrollIntoView({ block: "end" }));
      await summary.fill("");
      await expect(summary).toHaveAttribute("aria-invalid", "true");
      const message = panel.locator(`[id="${await errorIdOf(summary)}"]`);
      await expect(message).toContainText("No puede estar vacío");
      await expectInside(message, panel);

      // Also after jumping to the field from the validation panel.
      await panel.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
      await validation(page)
        .getByRole("button", { name: /summary/ })
        .click();
      await expect(summary).toBeFocused();
      await expectInside(message, panel);
    });
  });
}

/** The id of the message of a field: the last id of its aria-describedby. */
const errorIdOf = async (field: Locator): Promise<string> => {
  const ids = (await field.getAttribute("aria-describedby"))?.split(" ") ?? [];
  const id = ids.at(-1);
  if (id === undefined) throw new Error("The field has no description");
  return id;
};
