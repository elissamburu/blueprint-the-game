// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The preview (RF-STU-08) and the answers view (RF-STU-09) of the 200 scenario over the temporary
// copy of content/: the whole game with the keyboard only up to the summary in the same panel, a
// change of the title in the YAML in the middle of a game and "Reiniciar", and the answers of the
// view against the answers of the YAML. Nothing is saved: the file on disk does not change.
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  board,
  expectedSlots,
  firstTryGreen,
  palette,
  slot,
  slotName,
  tabTo,
} from "./support/game";
import {
  cursorLine,
  editorContent,
  goToLineEnd,
  openScenario,
  saveState,
  scenarioFile,
  SCENARIOS,
} from "./support/studio";

const { id } = SCENARIOS.pdf;
/** Appended to the title in the middle of a game. */
const SUFFIX = " (versión 2)";
const CHANGED = "El escenario cambió: reiniciá para jugar la versión nueva.";

const changedNotice = (page: Page) => page.getByRole("status").filter({ hasText: CHANGED });

/** Puts the cursor at the end of the value of `title:` in the YAML editor (with the mouse). */
const editTitle = async (page: Page, suffix: string) => {
  const text = await readFile(scenarioFile(id), "utf8");
  const line = text.split(/\r?\n/).findIndex((l) => l.startsWith("title:")) + 1;
  await goToLineEnd(page, line);
  // Before the closing quote.
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(suffix);
};

test("jugar el borrador con teclado hasta el resumen, editar, reiniciar y ver las respuestas", async ({
  page,
}) => {
  const before = await readFile(scenarioFile(id), "utf8");
  // From the copy: the editor spec saves this scenario with another title before this one runs.
  const title = /^title: "(.*)"$/m.exec(before)?.[1] ?? SCENARIOS.pdf.title;
  const slots = await expectedSlots(id);
  await openScenario(page, title);
  const play = page.getByRole("tab", { name: "Jugar" });
  // "Formulario" is the first tab: the arrows go through "Diagrama" to "Jugar" and activate it.
  await page.getByRole("tab", { name: "Formulario" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Diagrama" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.keyboard.press("ArrowRight");
  await expect(play).toHaveAttribute("aria-selected", "true");

  await test.step("con teclado: «Empezar partida», el brief y cada casillero con su óptimo", async () => {
    const start = page.getByRole("button", { name: "Empezar partida" });
    await play.focus();
    await tabTo(page, start, "«Empezar partida»");
    await page.keyboard.press("Enter");
    // The brief of the game, modal, with the focus on its main action.
    const brief = page.getByRole("dialog", { name: title });
    await expect(brief).toBeVisible();
    await expect(brief.getByRole("button", { name: "Empezar a diseñar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(brief).toBeHidden();
    await expect(board(page)).toBeFocused();

    const search = palette(page).getByRole("searchbox", { name: "Buscar servicio" });
    for (const target of slots) {
      const button = slot(page, target.role);
      await tabTo(page, button, `el casillero ${target.number}`);
      await page.keyboard.press("Enter");
      await expect(search).toBeFocused();
      await page.keyboard.type(target.optimal);
      await page.keyboard.press("Enter");
      await expect(button).toHaveAccessibleName(slotName(target.number, "Óptimo", target.optimal));
      await expect(button).toBeFocused();
      await expect(page.getByRole("region", { name: /^Óptimo/ })).toBeVisible();
      // The card stays open: on this narrower board it may cover the next slot, and then the
      // game closes it when the focus gets there (WCAG 2.4.11), as in the web.
    }
  });

  await test.step("«Finalizar»: el resumen en el mismo panel, con el foco en su título", async () => {
    await tabTo(page, page.getByRole("button", { name: "Finalizar" }), "«Finalizar»", "Shift+Tab");
    await page.keyboard.press("Enter");
    const summary = page.getByRole("heading", { level: 2, name: "Partida terminada" });
    await expect(summary).toBeFocused();
    const max = slots.length * (await firstTryGreen());
    await expect(page.locator("[data-slot=preview-summary]")).toContainText(
      `Puntaje: ${max} de ${max}`,
    );
    const grades = page.getByRole("list", { name: "Grado por casillero" }).getByRole("listitem");
    await expect(grades).toHaveCount(slots.length);
    for (const [index, target] of slots.entries()) {
      await expect(grades.nth(index)).toContainText(`Casillero ${target.number}:`);
      await expect(grades.nth(index)).toContainText("Óptimo");
      await expect(grades.nth(index)).toContainText(target.optimal);
    }
    // Nothing was saved: the page has no changes and the file is the same.
    await expect(saveState(page)).toHaveText("Guardado");
    expect(await readFile(scenarioFile(id), "utf8")).toBe(before);
  });

  await test.step("editar el título en medio de una partida: aviso y «Reiniciar»", async () => {
    await page.getByRole("button", { name: "Reiniciar" }).click();
    await page
      .getByRole("dialog", { name: title })
      .getByRole("button", { name: "Empezar a diseñar" })
      .click();
    await expect(board(page)).toBeVisible();
    await expect(changedNotice(page)).toHaveCount(0);

    await editTitle(page, SUFFIX);
    await expect(changedNotice(page)).toBeVisible();
    // The game goes on with the version it started with.
    await expect(board(page)).toHaveAccessibleName(`Diagrama de «${title}»`);

    await changedNotice(page).getByRole("button", { name: "Reiniciar" }).click();
    const brief = page.getByRole("dialog", { name: `${title}${SUFFIX}` });
    await expect(brief).toBeVisible();
    await brief.getByRole("button", { name: "Empezar a diseñar" }).click();
    await expect(board(page)).toHaveAccessibleName(`Diagrama de «${title}${SUFFIX}»`);
    await expect(changedNotice(page)).toHaveCount(0);
  });

  await test.step("«Respuestas»: las flechas cambian de pestaña sin perder el foco", async () => {
    await play.focus();
    await page.keyboard.press("ArrowRight");
    const answers = page.getByRole("tab", { name: "Respuestas" });
    await expect(answers).toBeFocused();
    await expect(answers).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByRole("heading", { level: 2, name: "Respuestas del borrador" }),
    ).toBeVisible();
  });

  await test.step("la lista de respuestas coincide con las del YAML", async () => {
    const picture = page.getByRole("group", {
      name: `Diagrama de «${title}${SUFFIX}» con las respuestas óptimas`,
    });
    await expect(picture).toBeVisible();
    for (const target of slots) {
      await expect(picture).toContainText(target.optimal);
      const section = page
        .getByRole("tabpanel", { name: "Respuestas" })
        .locator(`[data-slot-number="${target.number}"]`);
      await expect(section.getByRole("heading", { level: 3 })).toHaveText(
        `Casillero ${target.number}: ${target.role.trim().replace(/\.+$/, "")}`,
      );
      const items = section.locator("li[data-grade]");
      await expect(items).toHaveCount(target.answers.length);
      for (const [index, answer] of target.answers.entries()) {
        await expect(items.nth(index)).toHaveAttribute("data-grade", answer.grade);
        await expect(items.nth(index).locator("strong").first()).toHaveText(answer.name);
      }
    }
  });

  await test.step("con el YAML roto, la última versión válida y la línea del error", async () => {
    await editorContent(page).click();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Shift+Home");
    await page.keyboard.type("roto: [sin cerrar");
    const line = await cursorLine(page);
    await expect(page.locator("[data-draft-problem]")).toContainText(
      `El YAML tiene un error en la línea ${line}: se muestra la última versión válida.`,
    );
    await expect(
      page.getByRole("tabpanel", { name: "Respuestas" }).locator(`[data-slot-number="1"]`),
    ).toBeVisible();
    await page.getByRole("button", { name: `Ir a la línea ${line}` }).click();
    await expect(editorContent(page)).toBeFocused();
    expect(await cursorLine(page)).toBe(line);
  });
});
