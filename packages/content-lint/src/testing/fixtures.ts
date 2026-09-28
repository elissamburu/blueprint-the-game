// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal typed fixtures for rule tests. The base scenario passes every rule.
import type {
  ConfusionGroup,
  GameRules,
  Scenario,
  Service,
  SlotNode,
} from "@blueprint/scenario-schema";
import { createContext } from "../lint.js";
import type { Issue, LintInput, Rule } from "../types.js";

export const service = (
  id: string,
  name: string,
  leakPatterns: string[],
  overrides: Partial<Service> = {},
): Service => ({
  id,
  name,
  category: "test",
  aliases: [],
  leakPatterns,
  short: `Descripción corta de ${name}.`,
  docs: `https://docs.aws.amazon.com/${id}/`,
  ssmNamespaces: [],
  icon: `Arch_${id}_48`,
  status: "active",
  ...overrides,
});

export const catalog: Service[] = [
  service("s3", "Amazon S3", ["S3", "Simple Storage Service"]),
  service("efs", "Amazon EFS", ["EFS", "Elastic File System"]),
  service("lambda", "AWS Lambda", ["Lambda"]),
  service("fargate", "AWS Fargate", ["Fargate"]),
  service("ec2", "Amazon EC2", ["EC2", "Elastic Compute Cloud"]),
  service("dynamodb", "Amazon DynamoDB", ["DynamoDB"]),
  service("cloudwatch", "Amazon CloudWatch", ["CloudWatch"]),
  service("sqs", "Amazon SQS", ["SQS", "Simple Queue Service"]),
  service("simpledb", "Amazon SimpleDB", ["SimpleDB"], { status: "deprecated" }),
];

export const confusionGroups: ConfusionGroup[] = [
  { id: "compute", services: ["lambda", "ec2", "fargate"] },
];

export const gameRules: GameRules = {
  scoring: {
    firstTryGreen: 100,
    greenAfterErrors: { penaltyPerError: 25, min: 25 },
    acceptedAcceptable: 50,
    hintCost: 15,
  },
  levelMultipliers: { "100": 1, "200": 1.5, "300": 2, "400": 3 },
  ranks: [{ id: "aprendiz", name: "Aprendiz", minXp: 0 }],
  unlock: {
    scenariosRequired: 3,
    byExperience: {
      beginner: [100],
      "aws-user": [100, 200],
      architect: [100, 200, 300],
      expert: [100, 200, 300, 400],
    },
  },
  palette: {
    modeByLevel: { "100": "curated", "200": "categories", "300": "categories-plus", "400": "full" },
    defaultMaxSize: 12,
  },
};

/** Level 100, two slots, auto palette (resolves to curated with 3 distractors). */
export const baseScenario = (): Scenario => ({
  schemaVersion: 1,
  id: "club-photos",
  version: 1,
  status: "draft",
  lang: "es",
  level: 100,
  areas: ["serverless"],
  title: "Fotos de un club de barrio",
  summary: "Los socios suben fotos y el sistema genera miniaturas.",
  estimatedMinutes: 5,
  authors: [{ github: "autora" }],
  contributors: [],
  context: "Un club quiere que los socios suban fotos de los partidos.\nEl uso es esporádico.",
  objectives: [
    { id: "no-servers", kind: "hard", category: "operations", text: "No administrar servidores." },
    { id: "low-cost", kind: "soft", category: "cost", text: "Pagar poco cuando no hay uso." },
  ],
  diagram: {
    canvas: { width: 1200, height: 700 },
    groups: [
      {
        id: "cloud",
        kind: "aws-cloud",
        label: "Nube",
        rect: { x: 200, y: 40, w: 960, h: 620 },
        parent: null,
      },
    ],
    nodes: [
      {
        id: "member",
        type: "actor",
        label: "Socio",
        icon: "mobile",
        position: { x: 40, y: 300 },
      },
      {
        id: "store",
        type: "slot",
        role: "Almacenamiento durable donde quedan las fotos originales.",
        position: { x: 300, y: 120 },
        group: "cloud",
        answers: [
          {
            service: "s3",
            grade: "optimal",
            objectives: ["no-servers", "low-cost"],
            rationale: "Almacenamiento de objetos durable con pago por uso.",
            references: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"],
          },
        ],
        incorrect: [{ service: "efs", rationale: "Se monta desde cómputo; no recibe subidas." }],
        hints: ["Pensá en objetos, no en archivos."],
      },
      {
        id: "thumbnailer",
        type: "slot",
        role: "Lógica breve que genera la miniatura cuando llega una foto.",
        position: { x: 600, y: 120 },
        group: "cloud",
        answers: [
          {
            service: "lambda",
            grade: "optimal",
            objectives: ["no-servers", "low-cost"],
            rationale: "Cómputo por evento que no cobra sin uso.",
            references: ["https://docs.aws.amazon.com/lambda/latest/dg/welcome.html"],
          },
          {
            service: "fargate",
            grade: "acceptable",
            objectives: ["no-servers"],
            rationale: "Contenedores sin servidores, pero con arranque más lento.",
            references: [],
          },
        ],
        incorrect: [
          {
            service: "ec2",
            violates: ["no-servers"],
            rationale: "Hay que administrar instancias.",
          },
        ],
        hints: [],
      },
      {
        id: "logs",
        type: "fixed",
        service: "cloudwatch",
        position: { x: 900, y: 480 },
        group: "cloud",
      },
    ],
    edges: [
      { id: "e1", from: "member", to: "store", step: 1, label: "Sube la foto", style: "data" },
      {
        id: "e2",
        from: "store",
        to: "thumbnailer",
        step: 2,
        label: "Avisa que llegó",
        style: "async",
      },
      {
        id: "e3",
        from: "thumbnailer",
        to: "logs",
        step: 3,
        label: "Registra el resultado",
        style: "control",
      },
    ],
  },
  palette: { mode: "auto", extra: ["dynamodb"] },
  references: [],
});

export const baseInput = (scenario: Scenario = baseScenario()): LintInput => ({
  scenario,
  folderName: scenario.id,
  catalog,
  confusionGroups,
  gameRules,
});

/** Runs one rule on the base scenario after applying `mutate` to a fresh copy. */
export const runRule = (
  rule: Rule,
  mutate: (scenario: Scenario, input: LintInput) => void = () => undefined,
): Issue[] => {
  const input = baseInput();
  mutate(input.scenario, input);
  return rule.check(createContext(input));
};

export const slotById = (scenario: Scenario, id: string): SlotNode => {
  const node = scenario.diagram.nodes.find((n) => n.id === id);
  if (node?.type !== "slot") throw new Error(`fixture without slot ${id}`);
  return node;
};

export const nodeById = (scenario: Scenario, id: string): Scenario["diagram"]["nodes"][number] => {
  const node = scenario.diagram.nodes.find((n) => n.id === id);
  if (node === undefined) throw new Error(`fixture without node ${id}`);
  return node;
};
