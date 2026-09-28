// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test fixtures. Game rules and the serverless-pdf-processing scenario are the real content
// files, loaded with Vite's ?raw (no fs) and validated with the schema.
import {
  parseGameRules,
  parseScenario,
  type GameRules,
  type ParseResult,
  type Scenario,
  type SlotNode,
} from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import gameRulesRaw from "../../../../content/game-rules.yaml?raw";
import pdfRaw from "../../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";

const unwrap = <T>(result: ParseResult<T>): T => {
  if (!result.success) throw new Error(JSON.stringify(result.issues, null, 2));
  return result.data;
};

export const gameRules: GameRules = unwrap(parseGameRules(parseYaml(gameRulesRaw)));
export const pdfScenario: Scenario = unwrap(parseScenario(parseYaml(pdfRaw)));

export const slot = (id: string, overrides: Partial<SlotNode> = {}): SlotNode => ({
  id,
  type: "slot",
  position: { x: 0, y: 0 },
  role: `Rol de ${id}`,
  answers: [
    {
      service: "lambda",
      grade: "optimal",
      objectives: ["no-servers"],
      rationale: "Óptimo.",
      references: ["https://docs.aws.amazon.com/lambda/"],
    },
    {
      service: "fargate",
      grade: "acceptable",
      objectives: ["low-cost"],
      rationale: "Aceptable.",
      references: [],
    },
  ],
  incorrect: [
    { service: "ec2", violates: ["no-servers"], rationale: "Viola." },
    { service: "route53", rationale: "No cumple." },
  ],
  hints: ["Pista 1", "Pista 2"],
  ...overrides,
});

/** Minimal valid scenario with the given slots (level 100 unless overridden). */
export const scenario = (slots: SlotNode[], overrides: Partial<Scenario> = {}): Scenario => ({
  schemaVersion: 1,
  id: "test-scenario",
  version: 1,
  status: "published",
  lang: "es",
  level: 100,
  areas: ["serverless"],
  title: "Escenario de prueba",
  summary: "Resumen.",
  estimatedMinutes: 5,
  authors: [{ github: "tester" }],
  contributors: [],
  context: "Contexto.",
  objectives: [
    { id: "no-servers", kind: "hard", category: "operations", text: "Sin servidores." },
    { id: "low-cost", kind: "soft", category: "cost", text: "Bajo costo." },
  ],
  diagram: {
    canvas: { width: 1000, height: 600 },
    groups: [],
    nodes: [
      { id: "user", type: "actor", label: "Usuario", icon: "user", position: { x: 0, y: 0 } },
      { id: "logs", type: "fixed", service: "cloudwatch", position: { x: 0, y: 200 } },
      ...slots,
    ],
    edges: [],
  },
  references: [],
  ...overrides,
});
