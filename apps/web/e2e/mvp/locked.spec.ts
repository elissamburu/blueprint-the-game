// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RF-NAV-03, RF-NAV-04: a scenario of a level the player has not opened says why and cannot be
// played, neither from the listing nor by its URL.
import { expect, test } from "@playwright/test";
import { onboard, scenarioCard } from "../support/app";
import { AREAS, EXPERIENCE, PHOTO_QUEUE } from "../support/fixture";

const REASON = `Completá escenarios de nivel 100 en ${AREAS.serverless}.`;

test("un escenario de un nivel cerrado muestra el motivo y no se puede jugar", async ({ page }) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });

  await test.step("en el listado: bloqueado, con el motivo y sin «Jugar»", async () => {
    const card = scenarioCard(page, PHOTO_QUEUE.title);
    await expect(card).toContainText("Bloqueado");
    await expect(card).toContainText(REASON);
    await expect(card.getByRole("link")).toHaveCount(0);
  });

  await test.step("por URL: el motivo en lugar del brief", async () => {
    await page.goto(`/escenarios/${PHOTO_QUEUE.id}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Escenario bloqueado" }),
    ).toBeVisible();
    await expect(page.getByText(`«${PHOTO_QUEUE.title}» todavía no está disponible`)).toBeVisible();
    await expect(page.getByText(REASON)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Empezar a diseñar" })).toHaveCount(0);
    await expect(page.getByRole("group", { name: /^Diagrama de «/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Volver a escenarios" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  });
});
