// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Shared by the e2e server and the specs: the port, and the temporary copy of content/ the server
// writes to. The real content/ is never touched.
import { execSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AxeBuilder } from "@axe-core/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

export const E2E_PORT = 4321;
export const REPO_ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
export const E2E_ROOT = path.join(os.tmpdir(), "blueprint-studio-e2e");
export const E2E_CONTENT = path.join(E2E_ROOT, "content");
/** HOME of the e2e server: its .gitconfig gives the author of new scenarios (RF-STU-01). */
export const E2E_HOME = path.join(E2E_ROOT, "home");
export const E2E_AUTHOR = "e2e-autora";

export const scenarioFile = (id: string, name = "scenario.yaml") =>
  path.join(E2E_CONTENT, "scenarios", id, name);

/** `pnpm content:validate` over the copy: the exit code and the output. */
export const contentValidate = (): { code: number; output: string } => {
  try {
    const output = execSync(`pnpm --reporter=silent content:validate --content "${E2E_CONTENT}"`, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output };
  } catch (error) {
    const failure = error as { status?: number; stdout?: string; stderr?: string };
    return { code: failure.status ?? 1, output: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
};

export const editorContent = (page: Page): Locator => page.locator(".cm-content");

/** The panel's summary: the only live region of the editor page besides the save state. */
export const validationSummary = (page: Page): Locator =>
  page.getByRole("region", { name: "Validación" }).getByRole("status");

export const SCENARIOS = {
  site: {
    id: "static-website-https",
    title: "El sitio institucional de una ONG, seguro y rápido en todo el mundo",
  },
  pdf: { id: "serverless-pdf-processing", title: "Comprobantes en PDF para un estudio contable" },
  eks: {
    id: "private-eks-least-privilege",
    title: "Extractos bancarios en un clúster EKS sin salida a internet",
  },
} as const;

/** The save state of the top bar, in words. */
export const saveState = (page: Page): Locator => page.locator("[data-save-state]");

export const openScenario = async (page: Page, title: RegExp | string) => {
  await page.goto("/");
  // Exact: a copy made in the Studio keeps the title of its source and adds " (copia)".
  await page.getByRole("link", { name: title, exact: true }).click();
  await expect(editorContent(page)).toBeVisible();
  await expect(validationSummary(page)).not.toBeEmpty();
};

/** Number of the line where the cursor is (CodeMirror's active line gutter). */
export const cursorLine = async (page: Page): Promise<number> =>
  Number(await page.locator(".cm-activeLineGutter").first().innerText());

/**
 * Moves the cursor of the YAML editor to the end of a line (1-based) with the keyboard. Long lines
 * wrap, so ArrowDown and End work on visual lines: it goes down to the start of the next line and
 * back one character.
 */
export const goToLineEnd = async (page: Page, line: number) => {
  await editorContent(page).click();
  await page.keyboard.press("Control+Home");
  while ((await cursorLine(page)) <= line) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowLeft");
  expect(await cursorLine(page)).toBe(line);
};

/** axe on the page as it is now; the violations are soft failures, named by `screen`. */
export const expectNoViolations = async (page: Page, screen: string) => {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const found = violations.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `${violation.id} (${violation.impact ?? "?"}) en ${node.target.join(" ")}: ${node.failureSummary ?? violation.help}`,
    ),
  );
  expect.soft(found, `axe en «${screen}»`).toEqual([]);
};

/**
 * A dialog that covers what is behind it: once its animations end, the background of its content
 * is opaque (alpha 1, read through a canvas so any color syntax counts), the point at its center
 * is one of its own elements, and nothing inside it is wider than its box (a wider child spills
 * over the overlay and the page shows through around it).
 */
export const expectSolidDialog = async (dialog: Locator) => {
  await expect(dialog).toBeVisible();
  await dialog.evaluate((element) =>
    Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  const found = await dialog.evaluate((element) => {
    const canvas = document.createElement("canvas").getContext("2d");
    if (canvas === null) throw new Error("No 2D canvas");
    canvas.fillStyle = getComputedStyle(element).backgroundColor;
    canvas.fillRect(0, 0, 1, 1);
    const box = element.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return {
      alpha: (canvas.getImageData(0, 0, 1, 1).data[3] ?? 0) / 255,
      centerInside: hit !== null && element.contains(hit),
      overflow: element.scrollWidth - element.clientWidth,
    };
  });
  expect(found).toEqual({ alpha: 1, centerInside: true, overflow: 0 });
};
