// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Every scenario of the development bundle (drafts included) is playable to its maximum score:
// each slot gets the optimal service read from the content itself, turns green and the summary
// shows the top score. It catches what the content lint cannot: an optimal that the palette of
// the level leaves out, a slot the board does not draw, a scenario that does not load. A failure
// names the scenario and the slot.
import { expect, test } from "@playwright/test";
import {
  onboard,
  palette,
  paletteService,
  playFromListing,
  slot,
  slotName,
  summaryFigures,
} from "../support/app";
import { loadDevBundle } from "../support/dev-bundle";

const bundle = loadDevBundle();
const numbers = new Intl.NumberFormat("es-AR");

test("el bundle de desarrollo tiene escenarios", () => {
  expect(bundle.scenarios.length).toBeGreaterThan(0);
});

for (const entry of bundle.scenarios) {
  test(`${entry.id}: cada casillero acepta su óptimo y el resumen da el puntaje máximo`, async ({
    page,
  }) => {
    const scenario = bundle.scenario(entry);
    const answers = bundle.answers(scenario);

    // "Experto" opens every level in every area, so no scenario is locked.
    await onboard(page, { areas: bundle.areas.slice(0, 1), experience: "Experto" });

    await playFromListing(page, scenario.title);
    const search = palette(page).getByRole("searchbox", { name: "Buscar servicio" });

    for (const { slotId, role, optimal } of answers) {
      const where = `${entry.id} / ${slotId}`;
      const target = slot(page, role);
      await expect(target, `${where}: el casillero no está en el tablero`).toHaveCount(1);
      // With the keyboard, as it works for a slot the board has not scrolled into view.
      await target.press("Enter");
      await expect(search, `${where}: el casillero no quedó elegido`).toBeFocused();
      await search.fill(optimal);
      await expect(
        paletteService(page, optimal),
        `${where}: el óptimo «${optimal}» no está en la paleta`,
      ).toBeVisible();
      await paletteService(page, optimal).click();
      await expect(target, `${where}: «${optimal}» no quedó en verde`).toHaveAccessibleName(
        slotName(role, "Óptimo", optimal),
      );
    }

    const total = answers.length;
    await expect(page.getByText(`${total} de ${total} casilleros`)).toBeVisible();
    await page.getByRole("button", { name: "Finalizar" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeVisible();
    const max = numbers.format(total * bundle.rules.scoring.firstTryGreen);
    await expect(summaryFigures(page), `${entry.id}: el resumen no da el puntaje máximo`).toContainText(
      `${max}de ${max}`,
    );
    await expect(summaryFigures(page)).toContainText(
      total === 1 ? "1 óptimo" : `${total} óptimos`,
    );
  });
}
