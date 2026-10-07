// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal typed fixtures for rule tests. The base scenario passes every rule.
import type {
  Area,
  AwsService,
  Badge,
  Category,
  Concept,
  ConfusionGroup,
  GameRules,
  Scenario,
  Service,
  SlotNode,
} from "@blueprint/scenario-schema";
import { createContext } from "../lint.js";
import type { Issue, LintInput, Rule, SharedContentInput, SharedRule } from "../types.js";

export const service = (
  id: string,
  name: string,
  leakPatterns: string[],
  overrides: Partial<AwsService> = {},
): AwsService => ({
  type: "service",
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

export const concept = (
  id: string,
  name: string,
  leakPatterns: string[],
  overrides: Partial<Concept> = {},
): Concept => ({
  type: "concept",
  id,
  name,
  category: "concept-test",
  aliases: [],
  leakPatterns,
  short: `Descripción corta de ${name}.`,
  docs: `https://docs.aws.amazon.com/whitepapers/latest/${id}/`,
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
  concept("region", "Región de AWS", ["Región de AWS", "AWS Region"], {
    plainName: "Lugar del mundo",
    glyph: "region",
  }),
];

export const confusionGroups: ConfusionGroup[] = [
  { id: "compute", services: ["lambda", "ec2", "fargate"] },
];

export const categories: Category[] = [
  { id: "test", name: "Prueba", kind: "service", adjacent: ["other"] },
  { id: "other", name: "Otra", kind: "service", adjacent: [] },
  { id: "concept-test", name: "Conceptos de prueba", kind: "concept", adjacent: [] },
];

export const areas: Area[] = [
  { id: "serverless", name: "Serverless" },
  { id: "data", name: "Datos" },
];

export const badges: Badge[] = [
  {
    id: "primer-verde",
    name: "Primer verde",
    description: "Completaste tu primer escenario.",
    secret: false,
    rule: { type: "complete_count", count: 1 },
  },
  {
    id: "serverless-300",
    name: "Serverless 300",
    description: "Completaste 5 escenarios serverless de nivel 300.",
    secret: false,
    rule: { type: "complete_count", count: 5, level: 300, area: "serverless" },
  },
  {
    id: "maestro-datos",
    name: "Maestro de datos",
    description: "Completaste en verde el 80 % de los escenarios de datos.",
    secret: true,
    rule: { type: "area_mastery", area: "data", percent: 80 },
  },
  {
    id: "nivel-200",
    name: "Nivel 200 completo",
    description: "Completaste todos los escenarios publicados de nivel 200.",
    secret: false,
    rule: { type: "level_complete", level: 200 },
  },
];

export const gameRules: GameRules = {
  scoring: {
    firstTryGreen: 100,
    greenAfterErrors: { penaltyPerError: 25, min: 25 },
    acceptedAcceptable: 50,
    hintCost: 15,
    revealedSolution: 0,
  },
  levelMultipliers: { "100": 1, "200": 1.5, "300": 2, "400": 3 },
  ranks: [
    { id: "aprendiz", name: "Aprendiz", minXp: 0 },
    { id: "constructor", name: "Constructor", minXp: 1000 },
  ],
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
            objectives: ["low-cost"],
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
  areas,
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

/** Shared files that pass every C0xx rule, as fresh mutable copies. */
export const baseSharedInput = (): {
  [K in keyof SharedContentInput]: SharedContentInput[K] extends readonly (infer T)[]
    ? T[]
    : SharedContentInput[K];
} => structuredClone({ catalog, categories, confusionGroups, areas, gameRules, badges });

/** Runs one shared rule on the base shared files after applying `mutate` to a fresh copy. */
export const runSharedRule = (
  rule: SharedRule,
  mutate: (input: ReturnType<typeof baseSharedInput>) => void = () => undefined,
): Issue[] => {
  const input = baseSharedInput();
  mutate(input);
  return rule.check(input);
};
