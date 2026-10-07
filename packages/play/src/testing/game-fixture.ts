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

/**
 * Plain names for the level 0 tests: the real catalog has none yet (F2.1 PR 5). Entries without
 * one here get a made-up plain name.
 */
const PLAIN_NAMES: Readonly<Record<string, string>> = {
  s3: "Almacenamiento de archivos",
  lambda: "Función que corre sola",
};

/** Two concepts (ADR-0027 §1): one with a glyph and one without, which shows its initials. */
const CONCEPTS: readonly Service[] = [
  {
    type: "concept",
    id: "region",
    name: "Región de AWS",
    plainName: "Lugar del mundo",
    category: "concept-global-infrastructure",
    aliases: [],
    leakPatterns: ["Región de AWS"],
    short: "Área geográfica con varias zonas de disponibilidad.",
    docs: "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/global-infrastructure.html",
    status: "active",
    glyph: "region",
  },
  {
    type: "concept",
    id: "pay-as-you-go",
    name: "Pago por uso",
    plainName: "Pagar solo lo que usás",
    category: "concept-cloud-economics",
    aliases: [],
    leakPatterns: ["pago por uso"],
    short: "Se paga por lo que se consume.",
    docs: "https://aws.amazon.com/pricing/",
    status: "active",
  },
];

/** The catalog of the level 0 tests: every entry with a plain name, and two concepts. */
export const levelZeroServices = new Map<string, Service>(
  [
    ...bundle.catalog.services.map((s): Service => ({
      ...s,
      plainName: PLAIN_NAMES[s.id] ?? `Simple ${s.name}`,
    })),
    ...CONCEPTS,
  ].map((s) => [s.id, s]),
);

/** Where the analogy of S3 in "upload-store" breaks, in the level 0 version of the PDF scenario. */
export const S3_ANALOGY_LIMIT = {
  text: "Un archivo de papel tiene carpetas; acá cada documento es un **objeto** con su clave.",
  references: [
    "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html",
    "https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingObjects.html",
  ],
} as const;

/** The PDF scenario played at level 0, with an analogy limit on S3 in "upload-store". */
export const levelZeroScenario: Scenario = {
  ...pdfScenario,
  level: 0,
  diagram: {
    ...pdfScenario.diagram,
    nodes: pdfScenario.diagram.nodes.map((node) =>
      node.type === "slot" && node.id === "upload-store"
        ? {
            ...node,
            answers: node.answers.map((answer) =>
              answer.service === "s3"
                ? {
                    ...answer,
                    analogyLimit: {
                      text: S3_ANALOGY_LIMIT.text,
                      references: [...S3_ANALOGY_LIMIT.references],
                    },
                  }
                : answer,
            ),
          }
        : node,
    ),
  },
};
