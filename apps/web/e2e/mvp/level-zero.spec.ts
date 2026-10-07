// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RF-ONB-05, RF-NAV-08 (ADR-0027 §3): «Recién empiezo con la nube» starts at level 0, plays it
// end to end with XP ×0.5 and opens level 100; «Recién empiezo» still starts at 100 and has
// level 0 open. RF-PAL-06, RF-EVAL-07 (ADR-0027 §6): the level 0 card, the analogy limit in the
// feedback and in the solution sheets.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  feedback,
  finish,
  onboard,
  palette,
  paletteService,
  place,
  placeAll,
  playFromListing,
  scenarioCard,
  slot,
  slotName,
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

/** Font size and color of an element, in CSS px and as computed by the browser. */
const typeOf = (locator: Locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return { size: Number.parseFloat(style.fontSize), color: style.color };
  });

/** The computed color of --muted-foreground on the page. */
const mutedForeground = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--muted-foreground)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });

const PAIRS = Object.values(PIZZERIA.names);
const doubleName = ([plain, real]: readonly [string, string]) => `${plain} (${real})`;

test.describe("tarjeta del nivel 0 (RF-PAL-06) y analogía (RF-EVAL-07)", () => {
  test.beforeEach(async ({ page }) => {
    // «Recién empiezo con la nube» already marks «Fundamentos de la nube».
    await onboard(page, { areas: [], experience: EXPERIENCE.newcomer });
    await playFromListing(page, PIZZERIA.title);
  });

  test("el nombre accesible de cada tarjeta tiene el nombre simple y el real", async ({ page }) => {
    const muted = await mutedForeground(page);

    await test.step("paleta expandida: el simple arriba, el real abajo, chico y atenuado", async () => {
      const cards = palette(page).locator("[data-palette-service]");
      await expect(cards).toHaveCount(PAIRS.length);
      for (const pair of PAIRS) {
        const card = paletteService(page, doubleName(pair));
        await expect(card).toHaveAccessibleName(doubleName(pair));
        const real = card.locator('[data-slot="service-name-real"]');
        await expect(card.locator('[data-slot="service-name-plain"]')).toHaveText(pair[0]);
        await expect(real).toHaveText(pair[1]);
        const { size, color } = await typeOf(real);
        expect(size).toBeGreaterThanOrEqual(12);
        expect(color).toBe(muted);
      }
    });

    await test.step("el buscador encuentra la tarjeta por el nombre simple", async () => {
      await palette(page).getByRole("searchbox").fill("CENTRO de datos");
      await expect(palette(page).locator("[data-palette-service]")).toHaveCount(1);
      await expect(
        paletteService(page, "Centro de datos aparte (Zona de disponibilidad)"),
      ).toBeVisible();
      await palette(page).getByRole("searchbox").fill("");
    });

    await test.step("paleta colapsada: el tooltip y el nombre accesible son el mismo texto", async () => {
      await palette(page).getByRole("button", { name: "Colapsar la paleta" }).click();
      for (const pair of PAIRS) {
        const card = palette(page).getByRole("button", { name: doubleName(pair), exact: true });
        await card.hover();
        await expect(page.getByRole("tooltip")).toHaveText(doubleName(pair));
        // Away from the card, so the next tooltip is not this one still closing.
        await page.mouse.move(0, 0);
        await expect(page.getByRole("tooltip")).toHaveCount(0);
      }
      await palette(page).getByRole("button", { name: "Expandir la paleta" }).click();
    });

    await test.step("casillero revelado: los dos nombres, el real con 12 px o más", async () => {
      const { city } = PIZZERIA.slots;
      await place(page, city.role, city.optimal);
      const placed = slot(page, city.role);
      await expect(placed).toHaveAccessibleName(slotName(city.number, "Óptimo", city.optimal));
      const real = placed.locator('[data-slot="service-name-real"]');
      await expect(real).toHaveText("Región de AWS");
      const { size, color } = await typeOf(real);
      expect(size).toBeGreaterThanOrEqual(12);
      expect(color).toBe(muted);
    });
  });

  test("después de colocar, el feedback dice dónde se rompe la analogía", async ({ page }) => {
    const { recipes } = PIZZERIA.slots;
    await place(page, recipes.role, recipes.optimal);
    const card = feedback(page, "Óptimo");
    // The title names the service by its full name (the fixture has none: its name).
    await expect(card.getByRole("heading", { level: 2 })).toHaveText("ÓptimoAmazon S3");
    const analogy = card.getByRole("group", { name: "Dónde se rompe la analogía" });
    await expect(analogy).toContainText(recipes.analogyLimit);
    await expect(
      analogy.getByRole("link", { name: /^Documentación sobre la analogía/ }),
    ).toHaveAttribute("href", "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html");
  });

  test("las hojas de solución imprimen los dos nombres y la analogía, con 6,5 pt o más", async ({
    page,
  }) => {
    await page.goto(`/escenarios/${PIZZERIA.id}/imprimir`);
    await page.getByRole("checkbox", { name: "Incluir soluciones" }).check();
    await page.emulateMedia({ media: "print" });
    for (const { optimal, analogyLimit } of Object.values(PIZZERIA.slots)) {
      const answer = page.locator("li[data-grade]").filter({ hasText: optimal });
      await expect(answer.getByText(optimal, { exact: true })).toBeVisible();
      const analogy = answer.locator("[data-analogy-limit]");
      await expect(analogy).toContainText(`Dónde se rompe la analogía: ${analogyLimit}`);
      const sizes = await analogy
        .locator("p, a")
        .evaluateAll((els) => els.map((el) => Number.parseFloat(getComputedStyle(el).fontSize)));
      // 6.5 pt = 8.67 CSS px.
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual((6.5 * 96) / 72);
    }
  });
});
