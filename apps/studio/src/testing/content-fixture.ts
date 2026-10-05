// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The real content files (Vite ?raw, no fs) for the UI tests: the shared files as the API returns
// them, and the text of a scenario.yaml.
import type { Scenario } from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import areasRaw from "../../../../content/areas.yaml?raw";
import badgesRaw from "../../../../content/badges/badges.yaml?raw";
import categoriesRaw from "../../../../content/catalog/categories.yaml?raw";
import confusionGroupsRaw from "../../../../content/catalog/confusion-groups.yaml?raw";
import servicesRaw from "../../../../content/catalog/services.yaml?raw";
import gameRulesRaw from "../../../../content/game-rules.yaml?raw";
import pdfRaw from "../../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import { SharedResponseSchema, type SharedContent } from "../../shared/api";
import { validateScenarioText } from "../../shared/validation";

export const shared: SharedContent = SharedResponseSchema.parse({
  catalog: parseYaml(servicesRaw) as unknown,
  categories: parseYaml(categoriesRaw) as unknown,
  confusionGroups: parseYaml(confusionGroupsRaw) as unknown,
  areas: parseYaml(areasRaw) as unknown,
  gameRules: parseYaml(gameRulesRaw) as unknown,
  badges: parseYaml(badgesRaw) as unknown,
});

export const PDF_ID = "serverless-pdf-processing";
export const pdfYaml = pdfRaw;

/** The scenario of a scenario.yaml text that passes the schema. */
export const scenarioOf = (text: string, id = PDF_ID): Scenario => {
  const { scenario } = validateScenarioText(text, id, shared);
  if (scenario === undefined) throw new Error("the fixture does not pass the schema");
  return scenario;
};

export const serviceName = (id: string): string =>
  shared.catalog.find((service) => service.id === id)?.name ?? id;
