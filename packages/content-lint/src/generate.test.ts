// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Fixtures loaded with Vite's ?raw and import.meta.glob (no fs): a small scenario and catalog for
// the unit tests, and every scenario of content/ with its committed generated files.
import {
  isUnparsableDraft,
  parseScenario,
  parseServices,
  type Scenario,
  type Service,
} from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import realServicesRaw from "../../../content/catalog/services.yaml?raw";
import { GENERATED_NOTICE, renderDiagram, renderGeneratedFiles, renderReadme } from "./generate.js";
import scenarioRaw from "./testing/generator/club-photos.yaml?raw";
import servicesRaw from "./testing/generator/services.yaml?raw";

const parseCatalog = (raw: string): ReadonlyMap<string, Service> => {
  const result = parseServices(parse(raw));
  if (!result.success) throw new Error("invalid catalog fixture");
  return new Map(result.data.map((s) => [s.id, s]));
};
const parseFixture = (raw: string): Scenario => {
  const result = parseScenario(parse(raw));
  if (!result.success) throw new Error("invalid scenario fixture");
  return result.data;
};

const catalog = parseCatalog(servicesRaw);
const scenario = parseFixture(scenarioRaw);

const fresh = (): Scenario => structuredClone(scenario);

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
    expect(
      readme.startsWith(`<!-- ${GENERATED_NOTICE} -->\n\n# Fotos de un club de barrio\n`),
    ).toBe(true);
    expect(readme).toContain("**Spoilers:**");
    expect(readme).toContain("| Versión | 1 |");
    expect(readme).toContain(
      "| `no-servers` | Restricción | operations | No administrar servidores. |",
    );
    expect(readme).toContain("```mermaid\nflowchart LR\n");
  });

  it("lists every answer per slot with grade and rationale", () => {
    const readme = renderReadme(fresh(), catalog);
    expect(readme).toContain("### Casillero `thumbnailer`");
    expect(readme).toContain(
      "| AWS Fargate (`fargate`) | 🟠 Aceptable | `low-cost` | Contenedores sin servidores, pero con arranque más lento. |",
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

  it("reproduces the generated files committed for every scenario of content/", () => {
    const files = {
      ...import.meta.glob("../../../content/scenarios/*/scenario.yaml", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
      ...import.meta.glob("../../../content/scenarios/*/diagram.mmd", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
      ...import.meta.glob("../../../content/scenarios/*/README.md", {
        query: "?raw",
        import: "default",
        eager: true,
      }),
    };
    const realCatalog = parseCatalog(realServicesRaw);
    const dirs = Object.keys(files)
      .filter((file) => file.endsWith("/scenario.yaml") && !file.includes("/_"))
      .map((file) => file.slice(0, -"scenario.yaml".length));
    expect(dirs.length).toBeGreaterThanOrEqual(8);
    for (const dir of dirs) {
      const raw = files[`${dir}scenario.yaml`] ?? "";
      // The Studio saves drafts with errors (ADR-0025, amendment S10), possibly untracked in a
      // local checkout: a draft that does not parse has no generated files to compare, so it is
      // skipped. Any other scenario that does not parse still fails here.
      if (isUnparsableDraft(raw, parse)) continue;
      const generated = renderGeneratedFiles(parseFixture(raw), realCatalog);
      for (const [name, text] of Object.entries(generated)) {
        expect(files[`${dir}${name}`]?.replace(/\r\n/g, "\n"), `${dir}${name}`).toBe(text);
      }
    }
  });
});
