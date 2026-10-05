// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The real content files (Vite ?raw, no fs), parsed, for the game screen tests.
import { createSession, slotNodes, type SessionState } from "@blueprint/game-engine";
import {
  parseBundleCatalog,
  parseBundleIndex,
  parseGameRules,
  parseScenario,
  type ParseResult,
  type Scenario,
  type Service,
  type SlotNode,
} from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import areasRaw from "../../../../content/areas.yaml?raw";
import categoriesRaw from "../../../../content/catalog/categories.yaml?raw";
import confusionGroupsRaw from "../../../../content/catalog/confusion-groups.yaml?raw";
import servicesRaw from "../../../../content/catalog/services.yaml?raw";
import gameRulesRaw from "../../../../content/game-rules.yaml?raw";
import pdfRaw from "../../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import staticWebsiteRaw from "../../../../content/scenarios/static-website-https/scenario.yaml?raw";
import type { GameBundle } from "../host";

const unwrap = <T>(result: ParseResult<T>): T => {
  if (!result.success) throw new Error("invalid fixture");
  return result.data;
};

export const bundle: GameBundle = {
  index: unwrap(
    parseBundleIndex({ schemaVersion: 1, areas: parseYaml(areasRaw) as unknown, scenarios: [] }),
  ),
  catalog: unwrap(
    parseBundleCatalog({
      services: parseYaml(servicesRaw) as unknown,
      categories: parseYaml(categoriesRaw) as unknown,
      confusionGroups: parseYaml(confusionGroupsRaw) as unknown,
    }),
  ),
  rules: unwrap(parseGameRules(parseYaml(gameRulesRaw))),
};

export const pdfScenario: Scenario = unwrap(parseScenario(parseYaml(pdfRaw)));

export const staticWebsiteScenario: Scenario = unwrap(parseScenario(parseYaml(staticWebsiteRaw)));

export const services = new Map<string, Service>(bundle.catalog.services.map((s) => [s.id, s]));

export const slotOf = (scenario: Scenario, id: string): SlotNode => {
  const node = slotNodes(scenario).find((n) => n.id === id);
  if (node === undefined) throw new Error(`no slot ${id}`);
  return node;
};

export const newSession = (scenario: Scenario = pdfScenario): SessionState =>
  createSession(scenario, bundle.rules);
