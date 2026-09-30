// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reads the development bundle (dist/content-dev, built by `pnpm content:dev` with the drafts)
// from disk, validated with the same schemas the game uses, so the specs know the answers of the
// real content without copying them.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatIssues,
  parseBundleCatalog,
  parseBundleIndex,
  parseGameRules,
  parseScenario,
  type BundleIndexEntry,
  type GameRules,
  type ParseResult,
  type Scenario,
} from "@blueprint/scenario-schema";

const BUNDLE_DIR = fileURLToPath(new URL("../../../../dist/content-dev/", import.meta.url));

const load = <T>(file: string, parse: (input: unknown) => ParseResult<T>): T => {
  let text: string;
  try {
    text = readFileSync(path.join(BUNDLE_DIR, file), "utf8");
  } catch {
    throw new Error(
      `No se pudo leer dist/content-dev/${file}. Corré "pnpm e2e" desde la raíz del repo: genera el bundle de desarrollo antes de las pruebas.`,
    );
  }
  const result = parse(JSON.parse(text) as unknown);
  if (!result.success) {
    throw new Error(`dist/content-dev/${file} no es válido:\n${formatIssues(result.issues)}`);
  }
  return result.data;
};

export interface SlotAnswer {
  readonly slotId: string;
  /** Position of the slot among the slots of the diagram, from 1: its number on the board. */
  readonly number: number;
  readonly role: string;
  /** Name of the first optimal service, as the palette shows it. */
  readonly optimal: string;
}

export interface DevBundle {
  readonly scenarios: readonly BundleIndexEntry[];
  /** Names of the areas of interest, in the order of the onboarding. */
  readonly areas: readonly string[];
  readonly rules: GameRules;
  /** The full scenario of an index entry. */
  readonly scenario: (entry: BundleIndexEntry) => Scenario;
  /** Every slot of a scenario with the name of its first optimal service. */
  readonly answers: (scenario: Scenario) => SlotAnswer[];
}

export const loadDevBundle = (): DevBundle => {
  const index = load("index.json", parseBundleIndex);
  const catalog = load("catalog.json", parseBundleCatalog);
  const rules = load("game-rules.json", parseGameRules);
  const names = new Map(catalog.services.map((service) => [service.id, service.name]));
  return {
    scenarios: index.scenarios,
    areas: index.areas.map((area) => area.name),
    rules,
    scenario: (entry) => load(entry.file, parseScenario),
    answers: (scenario) =>
      scenario.diagram.nodes
        .filter((node) => node.type === "slot")
        .map((node, index) => {
          const optimal = node.answers.find((answer) => answer.grade === "optimal");
          const name = optimal === undefined ? undefined : names.get(optimal.service);
          if (name === undefined) {
            throw new Error(
              `${scenario.id} / ${node.id}: no tiene un óptimo que esté en el catálogo`,
            );
          }
          return { slotId: node.id, number: index + 1, role: node.role, optimal: name };
        }),
  };
};
