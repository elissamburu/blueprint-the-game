// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// System preferences (docs/accesibilidad.md §3, manual tests 6 and 7), emulated: with
// prefers-reduced-motion the flow player is still usable, step by step; with forced-colors the
// states of a slot are told apart without color, by their names and by the style of the border.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  board,
  emptySlotName,
  onboard,
  place,
  playFromListing,
  slot,
  slotName,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;
/** Longer than STEP_DURATION_MS (1800) of the flow player. */
const TWO_STEPS_MS = 4_000;

const openGame = async (page: Page) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await playFromListing(page, CLUB_PHOTOS.title);
};

const player = (page: Page): Locator => page.getByRole("group", { name: "Reproductor de flujo" });

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });

  test("el reproductor de flujo se usa paso a paso y no avanza solo", async ({ page }) => {
    await page.clock.install();
    await openGame(page);
    await page.getByRole("button", { name: "Reproducir flujo" }).click();

    await expect(page.getByText("Paso 1 de 4: Sube la foto.")).toBeAttached();
    // Nothing moves: no auto-advance (so nothing to pause) and no animated edge.
    await expect(player(page).getByRole("button", { name: "Pausar" })).toHaveCount(0);
    await expect(player(page).getByRole("button", { name: "Reproducir" })).toHaveCount(0);
    await expect(board(page).locator("animate")).toHaveCount(0);
    await page.clock.fastForward(TWO_STEPS_MS);
    await expect(page.getByText("Paso 1 de 4: Sube la foto.")).toBeAttached();

    await expect(player(page).getByRole("button", { name: "Paso anterior" })).toBeDisabled();
    await player(page).getByRole("button", { name: "Paso siguiente" }).click();
    await expect(page.getByText("Paso 2 de 4: Avisa que llegó.")).toBeAttached();
    await player(page).getByRole("button", { name: "Paso anterior" }).click();
    await expect(page.getByText("Paso 1 de 4: Sube la foto.")).toBeAttached();
    await player(page).getByRole("button", { name: "Detener" }).click();
    await expect(player(page)).toBeHidden();
  });
});

test.describe("prefers-reduced-motion: no-preference", () => {
  test("el reproductor avanza solo y se puede pausar", async ({ page }) => {
    await page.clock.install();
    await openGame(page);
    await page.getByRole("button", { name: "Reproducir flujo" }).click();
    await expect(page.getByText("Paso 1 de 4: Sube la foto.")).toBeAttached();
    await expect(player(page).getByRole("button", { name: "Pausar" })).toBeVisible();
    await page.clock.fastForward(TWO_STEPS_MS);
    await expect(page.getByText("Paso 3 de 4: Anota la miniatura.")).toBeAttached();
  });
});

test.describe("forced-colors: active", () => {
  test.use({ contextOptions: { forcedColors: "active" } });

  test("casillero revelado, verde y vacío se distinguen sin color", async ({ page }) => {
    await openGame(page);
    expect(await page.evaluate(() => matchMedia("(forced-colors: active)").matches)).toBe(true);

    await place(page, thumbnailer.role, thumbnailer.optimal);
    await page.getByRole("button", { name: "Cerrar explicación" }).click();
    await slot(page, store.role).click();
    await page.getByRole("button", { name: "Más acciones" }).click();
    await page.getByRole("menuitem", { name: "Ver solución de este casillero" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Ver solución" }).click();

    // In the accessibility tree: three different names, each with its state in words.
    const revealed = slot(page, store.role);
    const green = slot(page, thumbnailer.role);
    const empty = slot(page, index.role);
    await expect(revealed).toHaveAccessibleName(
      slotName(store.number, "Solución vista", store.optimal),
    );
    await expect(green).toHaveAccessibleName(
      slotName(thumbnailer.number, "Óptimo", thumbnailer.optimal),
    );
    await expect(empty).toHaveAccessibleName(emptySlotName(index.number));
    await expect(board(page)).toMatchAriaSnapshot(`
      - 'button "${slotName(store.number, "Solución vista", store.optimal)}"'
      - 'button "${slotName(thumbnailer.number, "Óptimo", thumbnailer.optimal)}"'
      - button "${emptySlotName(index.number)}"
    `);

    // And for the eye: the system paints every border with one color, so the style tells them
    // apart (double, solid, dashed).
    const borderStyle = (button: Locator) =>
      button.evaluate((el) => getComputedStyle(el.parentElement ?? el).borderTopStyle);
    expect(await borderStyle(revealed)).toBe("double");
    expect(await borderStyle(green)).toBe("solid");
    expect(await borderStyle(empty)).toBe("dashed");
  });

  test("el nivel de la barra del juego conserva texto y borde visibles", async ({ page }) => {
    await openGame(page);
    const badge = page.getByText("Nivel 100", { exact: true });
    await expect(badge).toBeVisible();
    const style = await badge.evaluate((el) => {
      const computed = getComputedStyle(el);
      return {
        text: computed.color,
        // What paints the glyphs when it is set; it has to follow the forced color too.
        fill: computed.getPropertyValue("-webkit-text-fill-color"),
        background: computed.backgroundColor,
        border: computed.borderTopColor,
        borderWidth: Number.parseFloat(computed.borderTopWidth),
        borderStyle: computed.borderTopStyle,
      };
    });
    expect(style.text).not.toBe(style.background);
    expect(style.fill).toBe(style.text);
    expect(style.border).toBe(style.text);
    expect(style.borderWidth).toBeGreaterThan(0);
    expect(style.borderStyle).toBe("solid");
  });
});
