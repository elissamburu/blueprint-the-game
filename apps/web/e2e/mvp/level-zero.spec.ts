// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RF-ONB-05, RF-NAV-08 (ADR-0027 §3): «Recién empiezo con la nube» starts at level 0, plays it
// end to end with XP ×0.5 and opens level 100; «Recién empiezo» still starts at 100 and has
// level 0 open.
import { expect, test } from "@playwright/test";
import {
  finish,
  onboard,
  placeAll,
  scenarioCard,
  startDesigning,
  summaryFigures,
} from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, PIZZERIA } from "../support/fixture";

const recommendedStart = (title: string) => ({ name: `Empezar escenario «${title}»` });

test("«Recién empiezo con la nube» juega el nivel 0 y abre el 100", async ({ page }) => {
  await test.step("onboarding: la opción nueva es la primera y marca su área", async () => {
    await page.goto("/");
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(5);
    const newcomer = page.getByRole("radio", { name: EXPERIENCE.newcomer, exact: true });
    await expect(radios.first()).toHaveAccessibleName(EXPERIENCE.newcomer);
    await newcomer.click();
    const basics = page.getByRole("button", { name: AREAS.fundamentos, exact: true });
    await expect(basics).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Ver mi ruta" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  });

  await test.step("el recomendado es de nivel 0 y los demás niveles están cerrados", async () => {
    await expect(scenarioCard(page, PIZZERIA.title)).toContainText("Nivel 0");
    await expect(scenarioCard(page, CLUB_PHOTOS.title)).toContainText("Bloqueado");
    await page.getByRole("link", recommendedStart(PIZZERIA.title)).click();
    await startDesigning(page, PIZZERIA.title);
  });

  await test.step("se completa con XP ×0,5 y abre el nivel 100", async () => {
    await placeAll(page, Object.values(PIZZERIA.slots));
    await finish(page);
    // 3 verdes al primer intento: 300 de 300; el nivel 0 multiplica por 0,5.
    const figures = summaryFigures(page);
    await expect(figures).toContainText("300de 300");
    await expect(figures).toContainText("+150");
    await expect(figures).toContainText("300 pts × 0,5 (nivel 0) = 150 XP");
    await expect(page.getByRole("region", { name: "Logros" })).toContainText(
      `Nivel 100 en ${AREAS.fundamentos}, ${AREAS.serverless} y ${AREAS.storage}.`,
    );
  });

  await test.step("el listado abre el nivel 100", async () => {
    await page.getByRole("link", { name: "Ver escenarios" }).click();
    await expect(
      scenarioCard(page, CLUB_PHOTOS.title).getByRole("link", { name: /^Jugar «/ }),
    ).toBeVisible();
  });
});

test("«Recién empiezo» sigue arrancando en 100 y ve el nivel 0 abierto", async ({ page }) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await expect(page.getByRole("link", recommendedStart(CLUB_PHOTOS.title))).toBeVisible();
  await expect(
    scenarioCard(page, PIZZERIA.title).getByRole("link", { name: /^Jugar «/ }),
  ).toBeVisible();
});
