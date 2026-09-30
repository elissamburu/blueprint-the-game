// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe on a real browser (docs/accesibilidad.md §7, "Automáticas"): computed styles, so contrast
// and "only color" rules run too, which the jsdom tests cannot check.
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const BLOCKING = new Set(["critical", "serious"]);

/** Entrance animations (dialogs, popovers) fade the text in: axe waits for them to end. */
const settle = (page: Page) =>
  page.evaluate(async () => {
    await Promise.all(document.getAnimations().map((animation) => animation.finished));
  });

/**
 * Fails with the critical and serious violations of the current screen. It is a soft assertion:
 * a journey through several states reports all of them, not only the first one.
 */
export const expectNoBlockingViolations = async (page: Page, screen: string) => {
  await settle(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const blocking = violations
    .filter((violation) => BLOCKING.has(violation.impact ?? ""))
    .flatMap((violation) =>
      violation.nodes.map(
        (node) =>
          `${violation.id} (${violation.impact ?? "?"}) en ${node.target.join(" ")}: ${node.failureSummary ?? violation.help}`,
      ),
    );
  expect.soft(blocking, `axe en «${screen}»`).toEqual([]);
};
