// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test bundle built from the real content files (Vite ?raw, no fs), shaped like the output of
// content:build, plus a fetch that serves it.
import type { BundleIndex, Scenario } from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import areasRaw from "../../../../../content/areas.yaml?raw";
import categoriesRaw from "../../../../../content/catalog/categories.yaml?raw";
import confusionGroupsRaw from "../../../../../content/catalog/confusion-groups.yaml?raw";
import servicesRaw from "../../../../../content/catalog/services.yaml?raw";
import gameRulesRaw from "../../../../../content/game-rules.yaml?raw";
import privateVpcRaw from "../../../../../content/scenarios/private-vpc-service-access/scenario.yaml?raw";
import pdfRaw from "../../../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import staticWebsiteRaw from "../../../../../content/scenarios/static-website-https/scenario.yaml?raw";

export const BASE_URL = "/content/";

type Status = Scenario["status"];

const scenarios = [staticWebsiteRaw, pdfRaw, privateVpcRaw].map((raw) => parseYaml(raw) as Scenario);

const fileOf = (scenario: Pick<Scenario, "id" | "version">) =>
  `${scenario.id}.v${scenario.version}.json`;

/**
 * Bundle files by name. `statuses` overrides the status of each scenario, in the order
 * static-website-https, serverless-pdf-processing, private-vpc-service-access.
 */
export const bundleFiles = (
  statuses: readonly Status[] = ["published", "beta", "draft"],
): Record<string, unknown> => {
  const withStatus = scenarios.map((scenario, i) => ({
    ...scenario,
    status: statuses[i] ?? scenario.status,
  }));
  const index: BundleIndex = {
    schemaVersion: 1,
    areas: parseYaml(areasRaw) as BundleIndex["areas"],
    scenarios: withStatus.map((s) => ({
      id: s.id,
      version: s.version,
      status: s.status,
      level: s.level,
      areas: s.areas,
      title: s.title,
      summary: s.summary,
      estimatedMinutes: s.estimatedMinutes,
      file: fileOf(s),
    })),
  };
  return {
    "index.json": index,
    "catalog.json": {
      services: parseYaml(servicesRaw) as unknown,
      categories: parseYaml(categoriesRaw) as unknown,
      confusionGroups: parseYaml(confusionGroupsRaw) as unknown,
    },
    "game-rules.json": parseYaml(gameRulesRaw) as unknown,
    ...Object.fromEntries(withStatus.map((s) => [fileOf(s), s])),
  };
};

/**
 * A fetch over `files`: objects are served as JSON, strings as they are (to test invalid
 * JSON) and missing names answer 404.
 */
export const fetchFrom =
  (files: Record<string, unknown>): typeof fetch =>
  (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const name = url.startsWith(BASE_URL) ? url.slice(BASE_URL.length) : url;
    if (!(name in files)) return Promise.resolve(new Response("Not found", { status: 404 }));
    const body = files[name];
    return Promise.resolve(
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  };
