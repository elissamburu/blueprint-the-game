// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Manual test 1 of docs/accesibilidad.md §7, automated: the whole journey with the keyboard
// only. After the first navigation nothing here uses the mouse. Every control is reached with
// Tab, the focus never lands hidden or covered (WCAG 2.4.11), Esc closes panels and gives the
// focus back, and the only focus traps are the modal dialogs. Whether the focus indicator is
// visible enough stays a manual check.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  board,
  feedback,
  headerRank,
  hintButton,
  palette,
  slot,
  slotName,
  summaryFigures,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, RANKS } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;
/** More than the focusable elements of any screen: a full lap of the Tab order. */
const MAX_TABS = 60;
const KEY_HOLD_MS = 50;

/** The focused element is inside the viewport and nothing is drawn over its center. */
const expectFocusNotObscured = async (page: Page, what: string) => {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const el = document.activeElement;
          if (el === null || el === document.body) return "no element has the focus";
          const rect = el.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
            return "outside the viewport";
          }
          const top = document.elementFromPoint(x, y);
          return top !== null && (el.contains(top) || top.contains(el))
            ? "visible"
            : `covered by <${top?.tagName.toLowerCase() ?? "nothing"}>`;
        }),
      { message: `the focus on ${what} must be visible and not covered` },
    )
    .toBe("visible");
};

/** Presses Tab (or Shift+Tab) until `target` has the focus. */
const tabTo = async (page: Page, target: Locator, what: string, key = "Tab") => {
  for (let presses = 0; presses <= MAX_TABS; presses++) {
    if (await target.evaluate((el) => el === document.activeElement)) {
      await expectFocusNotObscured(page, what);
      return;
    }
    await page.keyboard.press(key);
  }
  throw new Error(`${what} was not reached with ${MAX_TABS} presses of ${key}`);
};

test("el recorrido completo se hace solo con teclado", async ({ page }) => {
  const search = palette(page).getByRole("searchbox", { name: "Buscar servicio" });

  await test.step("onboarding", async () => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Armemos tu ruta de aprendizaje" }),
    ).toBeVisible();
    const area = page.getByRole("button", { name: AREAS.serverless, exact: true });
    await tabTo(page, area, "el área");
    await page.keyboard.press("Space");
    await expect(area).toHaveAttribute("aria-pressed", "true");
    // A radio group is one stop of the Tab order; the arrows move inside it.
    // With nothing checked, Tab enters the group on its first option.
    const first = page.getByRole("radio", { name: EXPERIENCE.newcomer, exact: true });
    await tabTo(page, first, "la experiencia");
    await page.keyboard.press("Space");
    await expect(first).toBeChecked();
    // Held for a moment, as a person does: the group checks the option the arrow lands on.
    const beginner = page.getByRole("radio", { name: EXPERIENCE.beginner, exact: true });
    await page.keyboard.press("ArrowDown", { delay: KEY_HOLD_MS });
    await expect(beginner).toBeChecked();
    await page.keyboard.press("ArrowDown", { delay: KEY_HOLD_MS });
    await expect(page.getByRole("radio", { name: EXPERIENCE["aws-user"] })).toBeChecked();
    await page.keyboard.press("ArrowUp", { delay: KEY_HOLD_MS });
    await expect(beginner).toBeChecked();
    await tabTo(page, page.getByRole("button", { name: "Ver mi ruta" }), "«Ver mi ruta»");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  });

  await test.step("listado → brief → tablero", async () => {
    await tabTo(
      page,
      page.getByRole("link", { name: `Jugar «${CLUB_PHOTOS.title}»` }),
      "«Jugar» del escenario",
    );
    await page.keyboard.press("Enter");
    // The brief is modal: the focus starts on its main action.
    const start = page.getByRole("button", { name: "Empezar a diseñar" });
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: CLUB_PHOTOS.title })).toBeHidden();
    await expect(board(page)).toBeFocused();
  });

  await test.step("«Ver caso»: Esc lo cierra y devuelve el foco; no atrapa el Tab", async () => {
    const viewCase = page.getByRole("button", { name: "Ver caso" });
    const panel = page.getByRole("dialog", { name: CLUB_PHOTOS.title });
    await tabTo(page, viewCase, "«Ver caso»", "Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(panel).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(viewCase).toBeFocused();

    // Not modal: Tab goes through its content and on to the rest of the screen.
    await page.keyboard.press("Enter");
    await expect(panel).toBeFocused();
    const close = panel.getByRole("button", { name: "Cerrar el caso" });
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).not.toBeFocused();
    expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(panel).toBeHidden();
    await expect(viewCase).toBeFocused();
  });

  await test.step("«Más acciones»: Esc cierra el menú y devuelve el foco", async () => {
    const more = page.getByRole("button", { name: "Más acciones" });
    await tabTo(page, more, "«Más acciones»");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(more).toBeFocused();
  });

  await test.step("error: casillero → buscador → servicio, y el foco vuelve al casillero", async () => {
    const target = slot(page, thumbnailer.role);
    await tabTo(page, target, "el casillero");
    await page.keyboard.press("Enter");
    await expect(target).toHaveAttribute("aria-pressed", "true");
    await expect(search).toBeFocused();
    await page.keyboard.type("EC2");
    await page.keyboard.press("Enter");
    await expect(target).toHaveAccessibleName(
      slotName(thumbnailer.number, "Incorrecto", thumbnailer.incorrect),
    );
    await expect(target).toBeFocused();
    await expect(feedback(page, "Incorrecto")).toBeVisible();
  });

  await test.step("pista: se abre al lado del casillero y Esc devuelve el foco", async () => {
    // The hint control is the next stop after its slot.
    await page.keyboard.press("Tab");
    const hint = hintButton(page, "Ver pista (−15 pts)", thumbnailer.number);
    await expect(hint).toBeFocused();
    await page.keyboard.press("Enter");
    const hints = page.getByRole("dialog", { name: /^Pistas · / });
    await expect(hints).toContainText(thumbnailer.hints[0]);
    await page.keyboard.press("Escape");
    await expect(hints).toBeHidden();
    await expect(hintButton(page, "Ver pistas", thumbnailer.number)).toBeFocused();
  });

  await test.step("aceptable: «Probar otra» y «Me quedo con esta»", async () => {
    await tabTo(page, page.getByRole("button", { name: "Probar otra" }), "«Probar otra»");
    await page.keyboard.press("Enter");
    await expect(search).toBeFocused();
    await page.keyboard.type("Fargate");
    await page.keyboard.press("Enter");
    const target = slot(page, thumbnailer.role);
    await expect(target).toHaveAccessibleName(
      slotName(thumbnailer.number, "Aceptable", thumbnailer.acceptable),
    );
    await tabTo(
      page,
      page.getByRole("button", { name: "Me quedo con esta" }),
      "«Me quedo con esta»",
    );
    await page.keyboard.press("Enter");
    await expect(feedback(page, "Aceptable")).toContainText("Te quedaste con esta");
    // The button is gone with the choice: the focus goes back to the slot, it is not lost.
    await expect(target).toBeFocused();
  });

  await test.step("óptimos: los otros dos casilleros", async () => {
    for (const [target, query] of [
      [store, "S3"],
      [index, "DynamoDB"],
    ] as const) {
      await tabTo(page, slot(page, target.role), "el casillero");
      await page.keyboard.press("Enter");
      await expect(search).toBeFocused();
      await page.keyboard.type(query);
      await page.keyboard.press("Enter");
      await expect(slot(page, target.role)).toHaveAccessibleName(
        slotName(target.number, "Óptimo", target.optimal),
      );
      await expect(slot(page, target.role)).toBeFocused();
      // Closing the explanation removes the button that had the focus: it goes back to the slot.
      await tabTo(
        page,
        page.getByRole("button", { name: "Cerrar explicación" }),
        "«Cerrar explicación»",
      );
      await page.keyboard.press("Enter");
      await expect(feedback(page, "Óptimo")).toBeHidden();
      await expect(slot(page, target.role)).toBeFocused();
    }
  });

  await test.step("finalizar: el resumen toma el foco en su título", async () => {
    await tabTo(page, page.getByRole("button", { name: "Finalizar" }), "«Finalizar»", "Shift+Tab");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeFocused();
    await expect(summaryFigures(page)).toContainText("235de 300");
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
    await tabTo(page, page.getByRole("link", { name: "Ver escenarios" }), "«Ver escenarios»");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  });
});
