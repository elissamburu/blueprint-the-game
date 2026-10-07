// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import exampleRaw from "../../../content/scenarios/serverless-pdf-processing/scenario.yaml?raw";
import templateRaw from "../../../content/scenarios/_templates/scenario.template.yaml?raw";
import { formatIssues, parseScenario, type SchemaIssue } from "./index.js";

type Json = Record<string, unknown>;

/** Fresh, mutable copy of the published example for each test. */
const example = (): Json => parseYaml(exampleRaw) as Json;

const nodes = (scenario: Json): Json[] => (scenario["diagram"] as Json)["nodes"] as Json[];
const edges = (scenario: Json): Json[] => (scenario["diagram"] as Json)["edges"] as Json[];
const nodeById = (scenario: Json, id: string): Json => {
  const node = nodes(scenario).find((n) => n["id"] === id);
  if (node === undefined) throw new Error(`fixture without node ${id}`);
  return node;
};

const issuesOf = (input: unknown): SchemaIssue[] => {
  const result = parseScenario(input);
  if (result.success) throw new Error("expected the scenario to be invalid");
  return result.issues;
};

describe("parseScenario: real content", () => {
  it("accepts the serverless-pdf-processing example", () => {
    const result = parseScenario(example());
    if (!result.success) throw new Error(formatIssues(result.issues));
    expect(result.data.id).toBe("serverless-pdf-processing");
    const slots = result.data.diagram.nodes.filter((n) => n.type === "slot");
    expect(slots).toHaveLength(7);
  });

  it("accepts the scenario template", () => {
    const result = parseScenario(parseYaml(templateRaw));
    if (!result.success) throw new Error(formatIssues(result.issues));
    expect(result.data.status).toBe("draft");
  });

  it("applies defaults to optional lists", () => {
    const scenario = example();
    delete scenario["references"];
    delete nodeById(scenario, "upload-store")["hints"];
    const result = parseScenario(scenario);
    if (!result.success) throw new Error(formatIssues(result.issues));
    expect(result.data.references).toEqual([]);
    expect(result.data.contributors).toEqual([]);
  });
});

describe("parseScenario: clear errors in Spanish", () => {
  it("rejects a level outside 100/200/300/400", () => {
    const scenario = example();
    scenario["level"] = 150;
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["level"],
        where: "level",
        message: "El nivel 150 no existe: tiene que ser 0, 100, 200, 300 o 400",
      },
    ]);
  });

  it("rejects an id with uppercase letters", () => {
    const scenario = example();
    scenario["id"] = "Serverless-PDF";
    const [issue] = issuesOf(scenario);
    expect(issue?.where).toBe("id");
    expect(issue?.message).toBe(
      '"Serverless-PDF" no es un id válido: usá kebab-case (minúsculas, números y guiones, p. ej. "mi-servicio")',
    );
  });

  it("rejects a slot without answers", () => {
    const scenario = example();
    delete nodeById(scenario, "upload-store")["answers"];
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["diagram", "nodes", 4, "answers"],
        where: "diagram.nodes[4] (upload-store).answers",
        message: 'Falta el campo obligatorio "answers"',
      },
    ]);
  });

  it("rejects a slot with an empty answers list", () => {
    const scenario = example();
    nodeById(scenario, "upload-store")["answers"] = [];
    expect(issuesOf(scenario)[0]?.message).toBe("Un casillero necesita al menos una respuesta");
  });

  it("rejects an unknown grade", () => {
    const scenario = example();
    const answers = nodeById(scenario, "api-entry")["answers"] as Json[];
    answers[1]!["grade"] = "good";
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["diagram", "nodes", 2, "answers", 1, "grade"],
        where: "diagram.nodes[2] (api-entry).answers[1].grade",
        message: 'grade "good" no es válido: usá "optimal", "acceptable"',
      },
    ]);
  });

  it("rejects a fixed node without service", () => {
    const scenario = example();
    delete nodeById(scenario, "logs")["service"];
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["diagram", "nodes", 1, "service"],
        where: "diagram.nodes[1] (logs).service",
        message: 'Falta el campo obligatorio "service"',
      },
    ]);
  });

  it("rejects an edge without step", () => {
    const scenario = example();
    delete edges(scenario)[2]!["step"];
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["diagram", "edges", 2, "step"],
        where: "diagram.edges[2] (e3).step",
        message: 'Falta el campo obligatorio "step"',
      },
    ]);
  });

  it("rejects an http (not https) reference", () => {
    const scenario = example();
    scenario["references"] = [
      { title: "Patrones", url: "http://aws.amazon.com/event-driven-architecture/" },
    ];
    expect(issuesOf(scenario)).toEqual([
      {
        path: ["references", 0, "url"],
        where: "references[0].url",
        message:
          '"http://aws.amazon.com/event-driven-architecture/" no es una URL válida: tiene que empezar con https://',
      },
    ]);
  });

  it("rejects an http reference in an answer", () => {
    const scenario = example();
    const answers = nodeById(scenario, "processor")["answers"] as Json[];
    answers[0]!["references"] = ["http://docs.aws.amazon.com/lambda/"];
    expect(issuesOf(scenario)[0]?.where).toBe(
      "diagram.nodes[6] (processor).answers[0].references[0]",
    );
  });

  it("rejects an unknown node type", () => {
    const scenario = example();
    nodeById(scenario, "client")["type"] = "user";
    expect(issuesOf(scenario)[0]?.message).toBe(
      'El nodo necesita "type" con uno de estos valores: "actor", "external", "fixed", "slot" (recibido: "user")',
    );
  });

  it("rejects actor nodes without label", () => {
    const scenario = example();
    delete nodeById(scenario, "client")["label"];
    expect(issuesOf(scenario)[0]?.message).toBe('Falta el campo obligatorio "label"');
  });

  it("rejects unknown fields and hints at typos", () => {
    const scenario = example();
    scenario["tittle"] = "x";
    expect(issuesOf(scenario)[0]?.message).toBe(
      'Campo desconocido: "tittle" (¿está bien escrito?)',
    );
  });

  it("only allows violates inside incorrect", () => {
    const scenario = example();
    const answers = nodeById(scenario, "api-entry")["answers"] as Json[];
    answers[1]!["violates"] = ["low-cost"];
    expect(issuesOf(scenario)[0]?.message).toBe(
      '"violates" solo se permite en "incorrect": si el servicio viola un objetivo, movelo a incorrect',
    );
  });

  it("requires a rationale in incorrect", () => {
    const scenario = example();
    const incorrect = nodeById(scenario, "upload-store")["incorrect"] as Json[];
    delete incorrect[0]!["rationale"];
    expect(issuesOf(scenario)[0]?.message).toBe('Falta el campo obligatorio "rationale"');
  });

  it("enforces the L013 length limits", () => {
    const scenario = example();
    scenario["title"] = "x".repeat(81);
    edges(scenario)[0]!["label"] = "y".repeat(41);
    const answers = nodeById(scenario, "api-entry")["answers"] as Json[];
    answers[0]!["rationale"] = "z".repeat(601);
    const messages = issuesOf(scenario).map((i) => `${i.where}: ${i.message}`);
    expect(messages).toEqual([
      "title: Puede tener como máximo 80 caracteres (tiene 81)",
      "diagram.nodes[2] (api-entry).answers[0].rationale: Puede tener como máximo 600 caracteres (tiene 601)",
      "diagram.edges[0] (e1).label: Puede tener como máximo 40 caracteres (tiene 41)",
    ]);
  });

  it("rejects more than 3 hints and empty texts", () => {
    const scenario = example();
    nodeById(scenario, "api-entry")["hints"] = ["a", "b", "c", "d"];
    scenario["summary"] = "   ";
    const messages = issuesOf(scenario).map((i) => i.message);
    expect(messages).toContain("Un casillero admite como máximo 3 pistas");
    expect(messages).toContain("No puede estar vacío");
  });

  it("requires at least one area and one objective", () => {
    const scenario = example();
    scenario["areas"] = [];
    scenario["objectives"] = [];
    expect(issuesOf(scenario).map((i) => i.message)).toEqual([
      "El escenario tiene que pertenecer al menos a un área",
      "El escenario necesita al menos un objetivo",
    ]);
  });

  it("reports wrong types with the received value", () => {
    const scenario = example();
    scenario["estimatedMinutes"] = "diez";
    expect(issuesOf(scenario)[0]?.message).toBe('Se esperaba un número, pero hay el texto "diez"');
  });

  it("rejects a non-positive or fractional step", () => {
    const scenario = example();
    edges(scenario)[0]!["step"] = 0;
    edges(scenario)[1]!["step"] = 1.5;
    expect(issuesOf(scenario).map((i) => i.message)).toEqual([
      "Tiene que ser mayor que 0",
      "Tiene que ser un número entero",
    ]);
  });
});

describe("parseScenario: palette", () => {
  const withPalette = (palette: Json): Json => ({ ...example(), palette });

  it.each(["auto", "curated"])("allows maxSize with mode %s", (mode) => {
    expect(parseScenario(withPalette({ mode, maxSize: 12 })).success).toBe(true);
  });

  it.each(["categories", "categories-plus", "full"])("rejects maxSize with mode %s", (mode) => {
    expect(issuesOf(withPalette({ mode, maxSize: 12 }))).toEqual([
      {
        path: ["palette"],
        where: "palette",
        message: '"maxSize" solo se permite con palette.mode "auto" o "curated"',
      },
    ]);
  });

  it("asks for a missing mode", () => {
    expect(issuesOf(withPalette({ maxSize: 10 }))[0]?.message).toBe(
      'Falta el campo obligatorio "mode": usá "auto", "curated", "categories", "categories-plus", "full"',
    );
  });

  it("rejects an unknown mode", () => {
    expect(issuesOf(withPalette({ mode: "random" }))[0]?.message).toBe(
      'palette.mode "random" no es válido: usá "auto", "curated", "categories", "categories-plus", "full"',
    );
  });
});

describe("formatIssues", () => {
  it("prints one issue per line", () => {
    const scenario = example();
    scenario["level"] = 150;
    scenario["status"] = "live";
    expect(formatIssues(issuesOf(scenario))).toBe(
      [
        'status: status "live" no es válido: usá "draft", "beta", "published", "retired"',
        "level: El nivel 150 no existe: tiene que ser 0, 100, 200, 300 o 400",
      ].join("\n"),
    );
  });

  it("describes a root-level problem", () => {
    expect(issuesOf("not a scenario")).toEqual([
      {
        path: [],
        where: "(raíz)",
        message: 'Se esperaba un objeto, pero hay el texto "not a scenario"',
      },
    ]);
  });
});

describe("parseScenario: analogyLimit", () => {
  const DOC = "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html";
  const withLimit = (analogyLimit: unknown): Json => {
    const scenario = example();
    const [answer] = nodeById(scenario, "upload-store")["answers"] as Json[];
    answer!["analogyLimit"] = analogyLimit;
    return scenario;
  };
  const messagesOf = (input: unknown): string[] =>
    issuesOf(input).map((issue) => `${issue.path.slice(-2).join(".")}: ${issue.message}`);

  it("is optional and accepts text with official references", () => {
    const result = parseScenario(
      withLimit({ text: "Una caja no tiene versiones.", references: [DOC] }),
    );
    if (!result.success) throw new Error(formatIssues(result.issues));
    const slot = result.data.diagram.nodes.find((n) => n.id === "upload-store");
    expect(slot?.type === "slot" && slot.answers[0]?.analogyLimit).toEqual({
      text: "Una caja no tiene versiones.",
      references: [DOC],
    });
    expect(parseScenario(example()).success).toBe(true);
  });

  it("accepts up to 300 characters and rejects 301", () => {
    expect(parseScenario(withLimit({ text: "x".repeat(300), references: [DOC] })).success).toBe(
      true,
    );
    expect(messagesOf(withLimit({ text: "x".repeat(301), references: [DOC] }))).toEqual([
      "analogyLimit.text: Puede tener como máximo 300 caracteres (tiene 301)",
    ]);
  });

  it("needs at least one reference", () => {
    expect(messagesOf(withLimit({ text: "Límite." }))).toEqual([
      'analogyLimit.references: Falta el campo obligatorio "references"',
    ]);
    expect(messagesOf(withLimit({ text: "Límite.", references: [] }))).toEqual([
      "analogyLimit.references: Dónde se rompe la analogía necesita al menos una referencia oficial",
    ]);
  });

  it("only accepts official documentation (the domains of L011)", () => {
    expect(
      messagesOf(withLimit({ text: "Límite.", references: [DOC, "https://repost.aws/x"] })),
    ).toEqual([
      'references.1: "https://repost.aws/x" no es documentación oficial: usá docs.aws.amazon.com o aws.amazon.com',
    ]);
    expect(
      parseScenario(
        withLimit({
          text: "Límite.",
          references: ["https://aws.amazon.com/what-is-cloud-computing/"],
        }),
      ).success,
    ).toBe(true);
  });

  it("rejects an empty text and unknown keys", () => {
    expect(messagesOf(withLimit({ text: " ", references: [DOC], url: DOC }))).toEqual([
      "analogyLimit.text: No puede estar vacío",
      '0.analogyLimit: Campo desconocido: "url" (¿está bien escrito?)',
    ]);
  });
});
