// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Nuevo escenario" covers the list behind it: its content is opaque and stays inside its box,
// also while duplicating the scenario with the longest title, whose name the selector cuts with
// an ellipsis but says whole (list and accessible name). The other dialogs of the Studio get the
// same check in their own specs (expectSolidDialog). Nothing is created.
import { expect, test } from "@playwright/test";
import { expectNoViolations, expectSolidDialog } from "./support/studio";

test("«Nuevo escenario» es opaco y el selector de duplicar no desborda", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("main").getByRole("link");
  await expect(links.first()).toBeVisible();
  await page.getByRole("button", { name: "Nuevo escenario" }).click();
  const dialog = page.getByRole("dialog", { name: "Nuevo escenario" });
  await expectSolidDialog(dialog);

  await dialog.getByRole("radio", { name: "Duplicar un escenario existente" }).click();
  const from = dialog.getByRole("combobox", { name: /^Escenario a duplicar/ });
  await from.click();
  const options = page.getByRole("listbox").getByRole("option");
  const names = await options.allInnerTexts();
  const longest = names.reduce((a, b) => (b.length > a.length ? b : a));
  // A title long enough to need the ellipsis in the field.
  expect(longest.length).toBeGreaterThan(70);
  const option = page.getByRole("option", { name: longest, exact: true });
  // The list shows the title whole, inside the screen.
  await expect(option).toHaveText(longest);
  const listbox = await page.getByRole("listbox").boundingBox();
  expect((listbox?.x ?? 0) + (listbox?.width ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  await option.click();
  // The chosen title does not widen the form: the dialog still covers the list.
  await expectSolidDialog(dialog);

  await expect(from).toHaveAccessibleName(`Escenario a duplicar ${longest}`);
  const field = await from.evaluate((element) => {
    const value = element.querySelector("[data-slot=select-value]");
    return {
      fits: element.scrollWidth <= element.clientWidth,
      ellipsis: value !== null && getComputedStyle(value).textOverflow === "ellipsis",
      cut: value !== null && value.scrollWidth > value.clientWidth,
    };
  });
  expect(field).toEqual({ fits: true, ellipsis: true, cut: true });
  // The suggested title is the copy's.
  await expect(dialog.getByRole("textbox", { name: "Título" })).toHaveValue(/ \(copia\)$/);
  await expectNoViolations(page, "«Nuevo escenario», duplicando");
});
