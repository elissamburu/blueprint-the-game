// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { createContext } from "../lint.js";
import { baseInput, catalog, runRule, service, slotById } from "../testing/fixtures.js";
import { l005, leakRegExp } from "./l005-leaks.js";

describe("L005 leaks", () => {
  it("passes when no text names a hidden service", () => {
    expect(runRule(l005)).toEqual([]);
  });

  it("fails when a text names an optimal answer, case-insensitively", () => {
    const issues = runRule(l005, (scenario) => {
      scenario.title = "Fotos de un club con lambda";
    });
    expect(issues).toEqual([
      {
        code: "L005",
        severity: "error",
        message:
          'El texto nombra "lambda", que delata AWS Lambda, respuesta del casillero "thumbnailer". Reformulalo sin nombrar el servicio.',
        path: ["title"],
      },
    ]);
  });

  it("fails when a text names an acceptable answer", () => {
    const issues = runRule(l005, (scenario) => {
      slotById(scenario, "store").role = "Almacén que después lee una tarea de Fargate.";
    });
    expect(issues.map((issue) => [issue.severity, issue.path])).toEqual([
      ["error", ["diagram", "nodes", 1, "role"]],
    ]);
  });

  it("warns when a text names an incorrect or palette.extra service", () => {
    const issues = runRule(l005, (scenario) => {
      scenario.context = "Hoy corre en una instancia EC2 y guarda todo en DynamoDB.";
    });
    expect(issues).toEqual([
      {
        code: "L005",
        severity: "warning",
        message:
          'El texto nombra "EC2" (Amazon EC2), un distractor del escenario (incorrect o palette.extra): delata respuestas por eliminación. Si es intencional, dejalo; si no, reformulalo.',
        path: ["context"],
      },
      expect.objectContaining({ severity: "warning", path: ["context"] }),
    ]);
    expect(issues[1]?.message).toContain("(Amazon DynamoDB)");
  });

  it("ignores services of fixed nodes, even when they are an answer elsewhere", () => {
    const issues = runRule(l005, (scenario) => {
      scenario.summary = "Registra todo en CloudWatch y usa Lambda.";
      scenario.diagram.nodes.push({
        id: "authorizer",
        type: "fixed",
        service: "lambda",
        position: { x: 900, y: 300 },
        group: "cloud",
      });
    });
    expect(issues).toEqual([]);
  });

  it("ignores services that do not take part in the scenario", () => {
    expect(
      runRule(l005, (scenario) => {
        scenario.context = "Nada de SQS por ahora.";
      }),
    ).toEqual([]);
  });

  it("checks every visible text field", () => {
    const issues = runRule(l005, (scenario) => {
      const text = "Guardado en S3";
      scenario.summary = text;
      scenario.objectives[0]!.text = text;
      scenario.diagram.groups[0]!.label = text;
      const member = scenario.diagram.nodes[0]!;
      if (member.type === "actor") member.label = text;
      scenario.diagram.nodes.push({
        id: "partner",
        type: "external",
        label: text,
        icon: "third-party",
        position: { x: 40, y: 500 },
      });
      slotById(scenario, "thumbnailer").hints = ["Nada que ver", text];
      scenario.diagram.edges[0]!.label = text;
      scenario.diagram.edges[1]!.description = text;
    });
    expect(issues.map((issue) => issue.path)).toEqual([
      ["summary"],
      ["objectives", 0, "text"],
      ["diagram", "groups", 0, "label"],
      ["diagram", "nodes", 0, "label"],
      ["diagram", "nodes", 2, "hints", 1],
      ["diagram", "nodes", 4, "label"],
      ["diagram", "edges", 0, "label"],
      ["diagram", "edges", 1, "description"],
    ]);
  });

  it("does not check rationales or scenario references", () => {
    expect(
      runRule(l005, (scenario) => {
        slotById(scenario, "store").answers[0]!.rationale = "S3 es almacenamiento de objetos.";
        scenario.references = [{ title: "Guía de S3", url: "https://aws.amazon.com/s3/" }];
      }),
    ).toEqual([]);
  });

  it("reports one issue per text and service", () => {
    const issues = runRule(l005, (scenario) => {
      scenario.context = "S3, S3 y otra vez Simple Storage Service.";
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('"S3"');
  });

  it("skips services missing from the catalog", () => {
    const input = baseInput();
    input.catalog = catalog.filter((s) => s.id !== "s3");
    input.scenario.title = "Todo en S3";
    expect(l005.check(createContext(input))).toEqual([]);
  });
});

describe("leakRegExp", () => {
  const matches = (pattern: string, text: string): boolean => leakRegExp(pattern).test(text);

  it("matches whole words only", () => {
    expect(matches("Lambda", "Una Lambda.")).toBe(true);
    expect(matches("Lambda", "(lambda)")).toBe(true);
    expect(matches("Lambda", "**Lambda**")).toBe(true);
    expect(matches("Lambda", "Lambdas")).toBe(false);
    expect(matches("S3", "S30")).toBe(false);
    expect(matches("S3", "MS3")).toBe(false);
    expect(matches("Config", "configuración")).toBe(false);
    expect(matches("Config", "AWS_Config")).toBe(false);
  });

  it("treats accented letters and ñ as letters", () => {
    // `\b` would fail here: é and ñ are not ASCII word characters.
    expect(matches("Servicio Café", "Usá el Servicio Café.")).toBe(true);
    expect(matches("Servicio Café", "usá el servicio CAFÉ")).toBe(true);
    expect(matches("Servicio Café", "el Servicio Cafés")).toBe(false);
    expect(matches("Glue", "Gluë")).toBe(false);
    expect(matches("Glue", "ñGlue")).toBe(false);
    expect(matches("Glue", "¿Glue?")).toBe(true);
  });

  it("matches multi-word patterns across any whitespace", () => {
    expect(matches("Simple Storage Service", "Simple\n  Storage Service")).toBe(true);
  });

  it("escapes regular expression characters in patterns", () => {
    expect(matches("Route 53 (DNS)", "Route 53 (DNS)")).toBe(true);
    expect(matches("A.B", "AxB")).toBe(false);
  });

  it("works with catalog services whose patterns carry accents", () => {
    const input = baseInput();
    input.catalog = [
      ...catalog.filter((s) => s.id !== "s3"),
      service("s3", "Amazon S3", ["Almacén Rápido"]),
    ];
    input.scenario.context = "Todo va al almacén rápido.";
    expect(l005.check(createContext(input)).map((issue) => issue.severity)).toEqual(["error"]);
  });
});
