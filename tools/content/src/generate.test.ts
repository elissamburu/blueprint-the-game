// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseScenario, parseServices, type Scenario, type Service } from "@blueprint/scenario-schema";
import { beforeAll, describe, expect, it } from "vitest";
import { parseYaml } from "./content.js";
import { GENERATED_NOTICE, renderDiagram, renderGeneratedFiles, renderReadme } from "./generate.js";
import { FIXTURE_CONTENT } from "./testing/fixture.js";

const loadYaml = async (...segments: string[]): Promise<unknown> => {
  const result = parseYaml(await readFile(path.join(FIXTURE_CONTENT, ...segments), "utf8"), "x");
  if (!result.ok) throw new Error("invalid fixture YAML");
  return result.value;
};

let catalog: Map<string, Service>;
let scenario: Scenario;

const fresh = (): Scenario => structuredClone(scenario);

beforeAll(async () => {
  const services = parseServices(await loadYaml("catalog", "services.yaml"));
  const parsed = parseScenario(await loadYaml("scenarios", "club-photos", "scenario.yaml"));
  if (!services.success || !parsed.success) throw new Error("invalid fixtures");
  catalog = new Map(services.data.map((s) => [s.id, s]));
  scenario = parsed.data;
});

describe("renderDiagram", () => {
  it("starts with the generated-file header and a flowchart", () => {
    const lines = renderDiagram(fresh(), catalog).split("\n");
    expect(lines[0]).toBe(`%% ${GENERATED_NOTICE}`);
    expect(lines[2]).toBe("flowchart LR");
  });

  it("shows slots with the catalog name of their optimal answers, inside their group", () => {
    const diagram = renderDiagram(fresh(), catalog);
    expect(diagram).toContain('  subgraph g_cloud["Nube"]\n    n_store["Amazon S3"]');
    expect(diagram).toContain('n_thumbnailer["AWS Lambda"]');
    expect(diagram).not.toContain("AWS Fargate");
    expect(diagram).toContain("class n_store,n_thumbnailer slot");
  });

  it("labels edges with 'step. label', ordered by step, with an arrow per style", () => {
    const s = fresh();
    s.diagram.edges.reverse();
    const edges = renderDiagram(s, catalog)
      .split("\n")
      .filter((line) => line.includes("|"));
    expect(edges).toEqual([
      '  n_member ==>|"1. Sube la foto"| n_store',
      '  n_store -.->|"2. Avisa que llegó"| n_thumbnailer',
      '  n_thumbnailer --o|"3. Registra el resultado"| n_logs',
    ]);
  });

  it("joins several optimal answers and escapes quotes", () => {
    const s = fresh();
    const slot = s.diagram.nodes.find((n) => n.id === "thumbnailer");
    if (slot?.type !== "slot") throw new Error("fixture");
    const second = slot.answers[1];
    if (second === undefined) throw new Error("fixture");
    second.grade = "optimal";
    const first = s.diagram.edges[0];
    if (first === undefined) throw new Error("fixture");
    first.label = 'Sube "la" foto';
    const diagram = renderDiagram(s, catalog);
    expect(diagram).toContain('n_thumbnailer["AWS Lambda / AWS Fargate"]');
    expect(diagram).toContain("1. Sube #quot;la#quot; foto");
  });

  it("nests child groups inside their parent", () => {
    const s = fresh();
    s.diagram.groups.push({
      id: "region",
      kind: "region",
      label: "Región",
      rect: { x: 250, y: 60, w: 800, h: 500 },
      parent: "cloud",
    });
    const store = s.diagram.nodes.find((n) => n.id === "store");
    if (store === undefined) throw new Error("fixture");
    store.group = "region";
    expect(renderDiagram(s, catalog)).toContain(
      '  subgraph g_cloud["Nube"]\n    subgraph g_region["Región"]\n      n_store["Amazon S3"]\n    end\n',
    );
  });

  it("does not loop on group cycles", () => {
    const s = fresh();
    s.diagram.groups.push(
      { id: "a", kind: "generic", label: "A", rect: { x: 0, y: 0, w: 1, h: 1 }, parent: "b" },
      { id: "b", kind: "generic", label: "B", rect: { x: 0, y: 0, w: 1, h: 1 }, parent: "a" },
    );
    const diagram = renderDiagram(s, catalog);
    expect(diagram.match(/subgraph g_a/g)).toHaveLength(1);
    expect(diagram.match(/subgraph g_b/g)).toHaveLength(1);
  });
});

describe("renderReadme", () => {
  it("has the generated header, spoiler warning, metadata, objectives and embedded Mermaid", () => {
    const readme = renderReadme(fresh(), catalog);
    expect(readme.startsWith(`<!-- ${GENERATED_NOTICE} -->\n\n# Fotos de un club de barrio\n`)).toBe(
      true,
    );
    expect(readme).toContain("**Spoilers:**");
    expect(readme).toContain("| Versión | 1 |");
    expect(readme).toContain("| `no-servers` | Restricción | operations | No administrar servidores. |");
    expect(readme).toContain("```mermaid\nflowchart LR\n");
  });

  it("lists every answer per slot with grade and rationale", () => {
    const readme = renderReadme(fresh(), catalog);
    expect(readme).toContain("### Casillero `thumbnailer`");
    expect(readme).toContain(
      "| AWS Fargate (`fargate`) | 🟠 Aceptable | `no-servers` | Contenedores sin servidores, pero con arranque más lento. |",
    );
    expect(readme).toContain(
      "| Amazon EC2 (`ec2`) | 🔴 Incorrecto | viola `no-servers` | Hay que administrar instancias. |",
    );
  });

  it("escapes pipes and newlines inside table cells", () => {
    const s = fresh();
    const slot = s.diagram.nodes.find((n) => n.id === "store");
    if (slot?.type !== "slot" || slot.answers[0] === undefined) throw new Error("fixture");
    slot.answers[0].rationale = "Uno | dos\ntres";
    expect(renderReadme(s, catalog)).toContain("Uno \\| dos tres");
  });
});

describe("renderGeneratedFiles", () => {
  it("is deterministic, uses LF and ends with exactly one newline", () => {
    const first = renderGeneratedFiles(fresh(), catalog);
    const second = renderGeneratedFiles(fresh(), catalog);
    expect(second).toEqual(first);
    for (const text of Object.values(first)) {
      expect(text).not.toContain("\r");
      expect(text.endsWith("\n")).toBe(true);
      expect(text.endsWith("\n\n")).toBe(false);
      expect(text.split("\n").some((line) => line !== line.trimEnd())).toBe(false);
    }
  });

  it("matches the files committed in the fixtures", async () => {
    const files = renderGeneratedFiles(fresh(), catalog);
    for (const [name, text] of Object.entries(files)) {
      const committed = await readFile(
        path.join(FIXTURE_CONTENT, "scenarios", "club-photos", name),
        "utf8",
      );
      expect(committed.replace(/\r\n/g, "\n")).toBe(text);
    }
  });
});
