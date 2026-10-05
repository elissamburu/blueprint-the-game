// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The preview of the Studio is the game screen of @blueprint/play: the locators of the game's e2e
// (apps/web/e2e/support/app.ts), and the expected answers read from the scenario.yaml of the
// temporary copy and its catalog.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { parse } from "yaml";
import { E2E_CONTENT, scenarioFile } from "./studio";

/** More than the focusable elements of the editor page: a full lap of the Tab order. */
const MAX_TABS = 80;

export const board = (page: Page): Locator => page.getByRole("group", { name: /^Diagrama de «/ });

export const palette = (page: Page): Locator =>
  page.getByRole("complementary", { name: "Paleta de servicios" });

/** A slot of the board by the role it shows (its accessible description). */
export const slot = (page: Page, role: string): Locator =>
  board(page)
    .getByRole("button")
    .filter({ has: page.getByText(role, { exact: true }) });

export const slotName = (number: number, state: string, service: string): string =>
  `${state}: ${service}, casillero ${number}`;

/**
 * Presses Tab (or Shift+Tab) until `target` has the focus. It never goes into the YAML editor:
 * there Tab indents, and the text would change.
 */
export const tabTo = async (page: Page, target: Locator, what: string, key = "Tab") => {
  for (let presses = 0; presses <= MAX_TABS; presses++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press(key);
    const inEditor = await page.evaluate(
      () => document.activeElement?.closest(".cm-editor") !== null,
    );
    expect(inEditor, `${key} reached the YAML editor looking for ${what}`).toBe(false);
  }
  throw new Error(`${what} was not reached with ${MAX_TABS} presses of ${key}`);
};

export interface ExpectedSlot {
  number: number;
  role: string;
  /** Names of the answers, in the order of the answers view: optimal, acceptable, incorrect. */
  answers: { grade: "optimal" | "acceptable" | "incorrect"; name: string }[];
  /** Name of the first optimal answer. */
  optimal: string;
}

interface YamlAnswer {
  service: string;
  grade?: string;
}
interface YamlNode {
  type: string;
  role?: string;
  answers?: YamlAnswer[];
  incorrect?: YamlAnswer[];
}

/** The slots of a scenario of the copy, numbered in diagram order as game-engine does. */
export const expectedSlots = async (id: string): Promise<ExpectedSlot[]> => {
  const scenario = parse(await readFile(scenarioFile(id), "utf8")) as {
    diagram: { nodes: YamlNode[] };
  };
  const catalog = parse(
    await readFile(path.join(E2E_CONTENT, "catalog", "services.yaml"), "utf8"),
  ) as { id: string; name: string }[];
  const name = (service: string) => catalog.find((s) => s.id === service)?.name ?? service;
  return scenario.diagram.nodes
    .filter((node) => node.type === "slot")
    .map((node, index) => {
      const answers = node.answers ?? [];
      const of = (grade: "optimal" | "acceptable") =>
        answers.filter((a) => a.grade === grade).map((a) => ({ grade, name: name(a.service) }));
      const optimal = of("optimal");
      return {
        number: index + 1,
        role: node.role ?? "",
        answers: [
          ...optimal,
          ...of("acceptable"),
          ...(node.incorrect ?? []).map((i) => ({
            grade: "incorrect" as const,
            name: name(i.service),
          })),
        ],
        optimal: optimal[0]?.name ?? "",
      };
    });
};

/** Points of a green at the first try (content/game-rules.yaml of the copy). */
export const firstTryGreen = async (): Promise<number> => {
  const rules = parse(await readFile(path.join(E2E_CONTENT, "game-rules.yaml"), "utf8")) as {
    scoring: { firstTryGreen: number };
  };
  return rules.scoring.firstTryGreen;
};
