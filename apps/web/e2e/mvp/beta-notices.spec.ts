// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Notices of the public beta: the beta one on every screen, which stays closed once closed, and
// the one for screens narrower than 1024 px, which never blocks the game.
import { expect, test, type Page } from "@playwright/test";
import { onboard, playFromListing, scenarioCard } from "../support/app";
import { expectNoBlockingViolations } from "../support/axe";
import { AREAS, CLUB_PHOTOS, EXPERIENCE } from "../support/fixture";

const betaNotice = (page: Page) => page.getByRole("region", { name: "Aviso de versión beta" });
const narrowNotice = (page: Page) =>
  page.getByRole("region", { name: "Aviso de pantalla angosta" });

const beginner = (page: Page) =>
  onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });

test("el aviso de beta está en cada pantalla, con el enlace de feedback", async ({ page }) => {
  await page.goto("/");
  await expect(betaNotice(page)).toContainText(
    "Estás probando una versión beta. Tu progreso se guarda solo en este navegador.",
  );
  // Without VITE_FEEDBACK_URL in the build: the feedback issue form of the repository.
  await expect(
    betaNotice(page).getByRole("link", { name: /^Contanos qué te pareció/ }),
  ).toHaveAttribute("href", /\/issues\/new\?template=feedback-beta\.yml$/);
  // A static region: nothing is announced when the page loads.
  await expect(betaNotice(page).locator("[aria-live], [role=status], [role=alert]")).toHaveCount(0);
  await expect(betaNotice(page)).not.toHaveAttribute("aria-live");
  // On a desktop screen there is no notice about narrow screens.
  await expect(narrowNotice(page)).toBeHidden();

  await beginner(page);
  await expect(betaNotice(page)).toBeVisible();
  // In the game too, once the brief (a modal dialog, which hides the rest) is closed.
  await playFromListing(page, CLUB_PHOTOS.title);
  await expect(betaNotice(page)).toBeVisible();
});

test("el aviso de beta se cierra y sigue cerrado al recargar", async ({ page }) => {
  await beginner(page);
  await betaNotice(page).getByRole("button", { name: "Cerrar el aviso de versión beta" }).click();
  await expect(betaNotice(page)).toHaveCount(0);
  // The focus is not lost: it goes to the content.
  await expect(page.getByRole("main")).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  await expect(betaNotice(page)).toHaveCount(0);
});

test.describe("pantalla de menos de 1024 px", () => {
  test.use({ viewport: { width: 1023, height: 800 } });

  test("avisa que está pensado para escritorio, sin bloquear, y se puede cerrar", async ({
    page,
  }) => {
    await beginner(page);
    await expect(narrowNotice(page)).toContainText(
      "Por ahora Blueprint está pensado para pantallas de escritorio. El modo para celular llega más adelante.",
    );
    await expect(betaNotice(page)).toBeVisible();
    await expectNoBlockingViolations(page, "listado, con los avisos de beta y de pantalla angosta");

    // It does not block: the listing works with the notice open.
    await expect(scenarioCard(page, CLUB_PHOTOS.title)).toBeVisible();
    await narrowNotice(page)
      .getByRole("button", { name: "Cerrar el aviso de pantalla angosta" })
      .click();
    await expect(narrowNotice(page)).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
    await expect(narrowNotice(page)).toHaveCount(0);
    await expect(betaNotice(page)).toBeVisible();
  });
});

test.describe("pantalla de 1024 px", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("no muestra el aviso de pantalla angosta", async ({ page }) => {
    await page.goto("/");
    await expect(betaNotice(page)).toBeVisible();
    await expect(narrowNotice(page)).toBeHidden();
  });
});
