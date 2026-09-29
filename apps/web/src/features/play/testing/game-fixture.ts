// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The real content bundle, parsed, for the game screen tests.
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
import type { ContentBundle } from "../../../content/load-bundle";
import { bundleFiles } from "../../../content/testing/bundle-fixture";

const unwrap = <T>(result: ParseResult<T>): T => {
  if (!result.success) throw new Error("invalid fixture");
  return result.data;
};

const files = bundleFiles(["published", "published", "published"]);

export const bundle: ContentBundle = {
  index: unwrap(parseBundleIndex(files["index.json"])),
  catalog: unwrap(parseBundleCatalog(files["catalog.json"])),
  rules: unwrap(parseGameRules(files["game-rules.json"])),
};

export const pdfScenario: Scenario = unwrap(
  parseScenario(files["serverless-pdf-processing.v1.json"]),
);

export const services = new Map<string, Service>(bundle.catalog.services.map((s) => [s.id, s]));

export const slotOf = (scenario: Scenario, id: string): SlotNode => {
  const node = slotNodes(scenario).find((n) => n.id === id);
  if (node === undefined) throw new Error(`no slot ${id}`);
  return node;
};

export const newSession = (scenario: Scenario = pdfScenario): SessionState =>
  createSession(scenario, bundle.rules);
