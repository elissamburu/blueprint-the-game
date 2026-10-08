// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Content-Security-Policy of the site (RNF-10, #44), against the preview server of
// tools/deploy-site: the assembled dist/site with the headers CloudFront adds, the policy among
// them (phase 1: Content-Security-Policy-Report-Only). The journey goes through what the policy
// could break: the shell, a reload of a route, the brief (a dialog), a drag onto the board, a
// popover, a menu and the printable version in another tab. Any securitypolicyviolation event,
// in any tab, fails the test.
import { readFileSync } from "node:fs";
import { parseBundleIndex } from "@blueprint/scenario-schema";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  board,
  emptySlotName,
  onboard,
  palette,
  playFromListing,
  scenarioCard,
} from "../support/app";

/** What a violation tells, for the message of the failure. */
interface Violation {
  readonly url: string;
  readonly directive: string;
  readonly blocked: string;
  readonly source: string;
  readonly sample: string;
}

declare global {
  interface Window {
    __cspViolations?: Violation[];
  }
}

const SITE_INDEX = new URL("../../../../dist/site/content/index.json", import.meta.url);

/** The bundle the site was assembled with (pnpm e2e runs site:assemble before the tests). */
const siteIndex = () => {
  const result = parseBundleIndex(JSON.parse(readFileSync(SITE_INDEX, "utf8")) as unknown);
  if (!result.success) throw new Error("dist/site/content/index.json no es válido");
  return result.data;
};

/** Registered before any script of the page runs, in every tab of the context. */
const recordViolations = (context: BrowserContext) =>
  context.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__cspViolations?.push({
        url: location.pathname,
        directive: event.effectiveDirective,
        blocked: event.blockedURI,
        source: `${event.sourceFile}:${event.lineNumber}:${event.columnNumber}`,
        sample: event.sample,
      });
    });
  });

const violations = async (context: BrowserContext): Promise<Violation[]> => {
  const all = await Promise.all(
    context.pages().map((page) => page.evaluate(() => window.__cspViolations ?? [])),
  );
  return all.flat();
};

/** Drags a card of the palette onto a slot with the mouse, as a player does (dnd-kit). */
const drag = async (page: Page, from: { x: number; y: number }, to: { x: number; y: number }) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // Past the 4 px of the activation constraint, then over the slot in steps.
  await page.mouse.move(from.x + 10, from.y + 10, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();
};

const center = async (page: Page, locator: ReturnType<Page["locator"]>) => {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box === null) throw new Error("no se ve el elemento");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test("el sitio no viola su Content-Security-Policy en el recorrido principal", async ({
  context,
  page,
}) => {
  const index = siteIndex();
  const entry = index.scenarios.find((s) => s.level > 0) ?? index.scenarios[0];
  if (entry === undefined) throw new Error("el bundle del sitio no tiene escenarios");
  await recordViolations(context);

  // The header of the shell is the one of the policy file, in Report-Only (phase 1).
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy-report-only"]).toMatch(/^default-src 'self'; /);
  expect(headers["content-security-policy"]).toBeUndefined();

  // Home and onboarding. «Experto» opens every level.
  await onboard(page, { areas: index.areas.slice(0, 1).map((a) => a.name), experience: "Experto" });

  // /escenarios, reloaded: the CloudFront Function serves the shell for the route.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Escenarios" })).toBeVisible();
  await expect(scenarioCard(page, entry.title)).toBeVisible();

  // A scenario: its brief is a dialog.
  await playFromListing(page, entry.title);

  // A card of the palette dragged onto the first slot.
  const firstSlot = board(page).getByRole("button", { name: emptySlotName(1), exact: true });
  // Any service: the grade does not matter here, only that the drop happens.
  const card = palette(page).locator("[data-palette-service]").first();
  await drag(page, await center(page, card), await center(page, firstSlot));
  await expect(
    board(page)
      .getByRole("button", { name: /, casillero 1$/ })
      .first(),
  ).not.toHaveAccessibleName(emptySlotName(1));
  const close = page.getByRole("button", { name: "Cerrar explicación" });
  if (await close.isVisible()) await close.click();

  // A popover: the hints of a slot.
  await board(page)
    .getByRole("button", { name: /^Ver pista/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: /^Pistas · / })).toBeVisible();
  await page.keyboard.press("Escape");

  // A menu, and from it the printable version in another tab, printed.
  await page.getByRole("button", { name: "Más acciones" }).click();
  const opened = context.waitForEvent("page");
  await page
    .getByRole("menuitem", { name: "Versión imprimible (se abre en otra pestaña)" })
    .click();
  const printable = await opened;
  await expect(printable.getByRole("heading", { level: 1, name: entry.title })).toBeVisible();
  await expect(
    printable.locator('[data-slot="diagram-print"] .react-flow__node').first(),
  ).toBeVisible();
  await printable.getByRole("checkbox", { name: "Incluir soluciones" }).check();
  await printable.emulateMedia({ media: "print" });
  await expect(printable.getByRole("banner")).toBeHidden();

  // Violations are reported in a task of their own: let any pending one arrive.
  await page.waitForTimeout(250);
  expect(await violations(context)).toEqual([]);
});
