// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import exampleRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import {
  adjacentCategories,
  buildCuratedPalette,
  formatIssues,
  parseScenario,
  resolvePaletteMode,
  type GameRules,
  type Scenario,
} from "./index.js";

const gameRules: Pick<GameRules, "palette"> = {
  palette: {
    modeByLevel: { "100": "curated", "200": "categories", "300": "categories-plus", "400": "full" },
    defaultMaxSize: 12,
  },
};

const example = (): Scenario => {
  const result = parseScenario(parseYaml(exampleRaw));
  if (!result.success) throw new Error(formatIssues(result.issues));
  return result.data;
};

const catalogOf = (...ids: string[]) => ids.map((id) => ({ id, status: "active" as const }));

/** Every service the example uses, plus confusion-group mates. */
const catalog = catalogOf(
  "apigateway",
  "alb",
  "route53",
  "ec2",
  "lambda",
  "fargate",
  "s3",
  "efs",
  "ebs",
  "dynamodb",
  "sqs",
  "eventbridge",
  "kinesis-data-streams",
  "sns",
  "textract",
  "bedrock",
  "rekognition",
  "sagemaker-ai",
  "aurora",
  "redshift",
  "elasticache",
  "cloudwatch",
  "mq",
);

describe("resolvePaletteMode", () => {
  it("keeps an explicit mode", () => {
    expect(
      resolvePaletteMode({ level: 100, palette: { mode: "full", extra: [] } }, gameRules),
    ).toBe("full");
  });

  it("resolves auto by level", () => {
    expect(
      resolvePaletteMode({ level: 100, palette: { mode: "auto", extra: [] } }, gameRules),
    ).toBe("curated");
    expect(
      resolvePaletteMode({ level: 300, palette: { mode: "auto", extra: [] } }, gameRules),
    ).toBe("categories-plus");
  });

  it("treats a missing palette as auto", () => {
    expect(resolvePaletteMode({ level: 200 }, gameRules)).toBe("categories");
  });
});

describe("buildCuratedPalette", () => {
  it("puts every answer first and trims distractors at maxSize", () => {
    const palette = buildCuratedPalette(example(), catalog, [], gameRules);
    expect(palette.maxSize).toBe(14);
    expect(palette.answers).toEqual([
      "apigateway",
      "alb",
      "lambda",
      "fargate",
      "s3",
      "sqs",
      "eventbridge",
      "kinesis-data-streams",
      "textract",
      "bedrock",
      "dynamodb",
      "aurora",
    ]);
    expect(palette.distractors).toEqual(["route53", "ec2"]);
    expect(palette.dropped).toEqual([
      "efs",
      "ebs",
      "sns",
      "rekognition",
      "sagemaker-ai",
      "redshift",
      "elasticache",
    ]);
    expect(palette.services).toEqual([...palette.answers, "route53", "ec2"]);
  });

  it("orders distractors: incorrect, extra, then confusion-group mates", () => {
    const scenario = example();
    scenario.palette = { mode: "curated", maxSize: 40, extra: ["cloudwatch", "mq", "efs"] };
    const palette = buildCuratedPalette(
      scenario,
      catalog,
      [{ services: ["sqs", "sns", "mq", "redshift"] }, { services: ["ec2", "lambda"] }],
      gameRules,
    );
    // cloudwatch is a fixed node; efs, sns, redshift and ec2 were already added as incorrect.
    expect(palette.distractors).toEqual([
      "route53",
      "ec2",
      "efs",
      "ebs",
      "sns",
      "rekognition",
      "sagemaker-ai",
      "redshift",
      "elasticache",
      "mq",
    ]);
    expect(palette.dropped).toEqual([]);
  });

  it("uses the default maxSize and never trims answers", () => {
    const scenario = example();
    delete scenario.palette;
    const palette = buildCuratedPalette(scenario, catalog, [], {
      palette: { ...gameRules.palette, defaultMaxSize: 5 },
    });
    expect(palette.maxSize).toBe(5);
    expect(palette.answers).toHaveLength(12);
    expect(palette.distractors).toEqual([]);
    expect(palette.services).toEqual(palette.answers);
  });

  it("ignores maxSize of non-curated modes and skips services missing from the catalog", () => {
    const scenario = example();
    scenario.palette = { mode: "full", extra: ["unknown-service"] };
    const palette = buildCuratedPalette(scenario, catalogOf("s3", "efs"), [], gameRules);
    expect(palette).toEqual({
      maxSize: 12,
      services: ["s3", "efs"],
      answers: ["s3"],
      distractors: ["efs"],
      dropped: [],
    });
  });

  it("leaves deprecated services out of the distractors, but keeps them as answers", () => {
    const scenario = example();
    scenario.palette = { mode: "curated", maxSize: 40, extra: ["mq"] };
    const deprecated = new Set(["aurora", "efs", "mq", "sns"]);
    const palette = buildCuratedPalette(
      scenario,
      catalog.map((service) =>
        deprecated.has(service.id) ? { ...service, status: "deprecated" as const } : service,
      ),
      [{ services: ["sqs", "sns", "redshift"] }],
      gameRules,
    );
    // aurora is an acceptable answer; efs and sns are incorrect, mq is extra.
    expect(palette.answers).toContain("aurora");
    expect(palette.services).toContain("aurora");
    expect(palette.distractors).not.toContain("efs");
    expect(palette.distractors).not.toContain("sns");
    expect(palette.distractors).not.toContain("mq");
    expect(palette.distractors).toEqual([
      "route53",
      "ec2",
      "ebs",
      "rekognition",
      "sagemaker-ai",
      "redshift",
      "elasticache",
    ]);
  });
});

describe("adjacentCategories", () => {
  const categories = [
    { id: "storage", adjacent: ["database"] },
    { id: "database", adjacent: [] },
    { id: "compute", adjacent: ["storage", "containers"] },
    { id: "containers", adjacent: ["compute"] },
  ];

  it("resolves adjacency in both directions, in file order", () => {
    expect(adjacentCategories(categories, "storage")).toEqual(["database", "compute"]);
    expect(adjacentCategories(categories, "database")).toEqual(["storage"]);
    expect(adjacentCategories(categories, "compute")).toEqual(["storage", "containers"]);
  });

  it("ignores the category itself and categories missing from the file", () => {
    expect(
      adjacentCategories([{ id: "storage", adjacent: ["storage", "unknown"] }], "storage"),
    ).toEqual([]);
    expect(adjacentCategories(categories, "unknown")).toEqual([]);
  });
});
