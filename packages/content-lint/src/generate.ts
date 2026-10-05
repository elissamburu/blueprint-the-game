// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Renders diagram.mmd and README.md for a scenario (docs/03 §1, RF-CNT-03). Pure and
// deterministic: same scenario and catalog ⇒ same bytes on every OS (LF, final newline). The two
// writers import it from here: pnpm content:gen (tools/content) and the Studio server when it saves
// (ADR-0025 §2); L012 (checkGeneratedFiles) compares its output with the files on disk.
import type {
  DiagramNode,
  EdgeStyle,
  Group,
  Scenario,
  Service,
  SlotNode,
} from "@blueprint/scenario-schema";

export const GENERATED_FILES = ["diagram.mmd", "README.md"] as const;
export type GeneratedFileName = (typeof GENERATED_FILES)[number];

export const GENERATED_NOTICE =
  "Archivo generado por pnpm content:gen a partir de scenario.yaml. No se edita a mano.";

type Catalog = ReadonlyMap<string, Service>;

const serviceName = (catalog: Catalog, id: string): string => catalog.get(id)?.name ?? id;

/** Joins lines with LF and guarantees exactly one final newline. */
const finish = (lines: readonly string[]): string =>
  `${lines.join("\n").replace(/\r\n?/g, "\n").trimEnd()}\n`;

// ---------------------------------------------------------------------------- Mermaid

/** Mermaid ids: prefixed so they never clash with keywords such as `end`. */
const nodeRef = (id: string): string => `n_${id.replace(/-/g, "_")}`;
const groupRef = (id: string): string => `g_${id.replace(/-/g, "_")}`;

/** Text inside a quoted Mermaid label. */
const mermaidText = (value: string): string =>
  value
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/"/g, "#quot;")
    .trim();

const optimalNames = (catalog: Catalog, slot: SlotNode): string =>
  slot.answers
    .filter((answer) => answer.grade === "optimal")
    .map((answer) => serviceName(catalog, answer.service))
    .join(" / ");

const nodeLine = (catalog: Catalog, node: DiagramNode): string => {
  const ref = nodeRef(node.id);
  switch (node.type) {
    case "actor":
      return `${ref}(["${mermaidText(node.label)}"])`;
    case "external":
      return `${ref}{{"${mermaidText(node.label)}"}}`;
    case "fixed":
      return `${ref}["${mermaidText(serviceName(catalog, node.service))}"]`;
    case "slot":
      return `${ref}["${mermaidText(optimalNames(catalog, node))}"]`;
  }
};

const ARROWS: Record<EdgeStyle, string> = {
  sync: "-->",
  async: "-.->",
  data: "==>",
  control: "--o",
};

/** The flowchart itself, without the generated-file header. */
const flowchart = (scenario: Scenario, catalog: Catalog): string[] => {
  const { groups, nodes, edges } = scenario.diagram;
  const groupIds = new Set(groups.map((group) => group.id));
  const lines = ["flowchart LR"];

  const topLevelNodes = nodes.filter(
    (node) => node.group === undefined || !groupIds.has(node.group),
  );
  for (const node of topLevelNodes) lines.push(`  ${nodeLine(catalog, node)}`);

  // Nesting follows `parent`; unknown parents and cycles (reported by L018) fall back to the
  // top level so the generator never loops.
  const rendered = new Set<string>();
  const renderGroup = (group: Group, depth: number): void => {
    rendered.add(group.id);
    const indent = "  ".repeat(depth);
    lines.push(`${indent}subgraph ${groupRef(group.id)}["${mermaidText(group.label)}"]`);
    for (const child of groups) {
      if (child.parent === group.id && !rendered.has(child.id)) renderGroup(child, depth + 1);
    }
    for (const node of nodes) {
      if (node.group === group.id) lines.push(`${indent}  ${nodeLine(catalog, node)}`);
    }
    lines.push(`${indent}end`);
  };
  const isTopLevel = (group: Group): boolean =>
    group.parent === null || group.parent === undefined || !groupIds.has(group.parent);
  for (const group of groups)
    if (isTopLevel(group) && !rendered.has(group.id)) renderGroup(group, 1);
  for (const group of groups) if (!rendered.has(group.id)) renderGroup(group, 1);

  const byStep = [...edges].sort((a, b) => a.step - b.step);
  for (const edge of byStep) {
    const label = mermaidText(`${edge.step}. ${edge.label}`);
    lines.push(`  ${nodeRef(edge.from)} ${ARROWS[edge.style]}|"${label}"| ${nodeRef(edge.to)}`);
  }

  const slots = nodes.filter((node) => node.type === "slot").map((node) => nodeRef(node.id));
  lines.push("  classDef slot stroke-dasharray: 6 4,stroke-width:2px");
  if (slots.length > 0) lines.push(`  class ${slots.join(",")} slot`);
  return lines;
};

export const renderDiagram = (scenario: Scenario, catalog: Catalog): string =>
  finish([
    `%% ${GENERATED_NOTICE}`,
    `%% Escenario: ${scenario.id} v${scenario.version}`,
    ...flowchart(scenario, catalog),
  ]);

// ----------------------------------------------------------------------------- README

/** Text inside a Markdown table cell. */
const cell = (value: string): string =>
  value
    .replace(/\s*\r?\n\s*/g, " ")
    .replace(/\|/g, "\\|")
    .trim();

const code = (value: string): string => `\`${value}\``;

const GRADE_LABEL = {
  optimal: "🟢 Óptimo",
  acceptable: "🟠 Aceptable",
  incorrect: "🔴 Incorrecto",
} as const;

const OBJECTIVE_KIND_LABEL = { hard: "Restricción", soft: "Meta" } as const;

const serviceCell = (catalog: Catalog, id: string): string =>
  cell(`${serviceName(catalog, id)} (${code(id)})`);

const linkList = (urls: readonly string[]): string =>
  urls.map((url, i) => `[${i + 1}](${url})`).join(" ");

const paletteSummary = (scenario: Scenario, catalog: Catalog): string => {
  const palette = scenario.palette;
  if (palette === undefined) return "auto";
  const maxSize = "maxSize" in palette && palette.maxSize !== undefined;
  const parts = [maxSize ? `${palette.mode} (máx. ${palette.maxSize})` : palette.mode];
  if (palette.extra.length > 0) {
    parts.push(`extra: ${palette.extra.map((id) => serviceName(catalog, id)).join(", ")}`);
  }
  return parts.join(" · ");
};

const slotSection = (catalog: Catalog, slot: SlotNode): string[] => {
  const lines = [`### Casillero ${code(slot.id)}`, "", `> ${cell(slot.role)}`, ""];
  lines.push("| Servicio | Grado | Objetivos | Justificación | Referencias |");
  lines.push("|---|---|---|---|---|");
  for (const answer of slot.answers) {
    lines.push(
      `| ${serviceCell(catalog, answer.service)} | ${GRADE_LABEL[answer.grade]} | ${answer.objectives.map(code).join(", ")} | ${cell(answer.rationale)} | ${linkList(answer.references)} |`,
    );
  }
  for (const incorrect of slot.incorrect) {
    const violates = (incorrect.violates ?? []).map(code).join(", ");
    lines.push(
      `| ${serviceCell(catalog, incorrect.service)} | ${GRADE_LABEL.incorrect} | ${violates === "" ? "—" : `viola ${violates}`} | ${cell(incorrect.rationale)} |  |`,
    );
  }
  if (slot.hints.length > 0) {
    lines.push("", "Pistas:", "");
    slot.hints.forEach((hint, i) => lines.push(`${i + 1}. ${cell(hint)}`));
  }
  lines.push("");
  return lines;
};

export const renderReadme = (scenario: Scenario, catalog: Catalog): string => {
  const people = (list: readonly { github: string }[]): string =>
    list.map((person) => `@${person.github}`).join(", ");
  const lines = [
    `<!-- ${GENERATED_NOTICE} -->`,
    "",
    `# ${scenario.title}`,
    "",
    "> ⚠️ **Spoilers:** esta ficha contiene las respuestas del escenario. Si lo querés jugar, no sigas leyendo.",
    "",
    scenario.summary,
    "",
    "| Campo | Valor |",
    "|---|---|",
    `| Id | ${code(scenario.id)} |`,
    `| Versión | ${scenario.version} |`,
    `| Estado | ${scenario.status} |`,
    `| Nivel | ${scenario.level} |`,
    `| Áreas | ${scenario.areas.map(code).join(", ")} |`,
    `| Duración estimada | ${scenario.estimatedMinutes} min |`,
    `| Autores | ${people(scenario.authors)} |`,
  ];
  if (scenario.contributors.length > 0) {
    lines.push(`| Colaboradores | ${people(scenario.contributors)} |`);
  }
  lines.push(`| Paleta | ${cell(paletteSummary(scenario, catalog))} |`, "");

  lines.push("## Contexto", "", scenario.context.trim(), "");

  lines.push("## Objetivos", "", "| Id | Tipo | Categoría | Objetivo |", "|---|---|---|---|");
  for (const objective of scenario.objectives) {
    lines.push(
      `| ${code(objective.id)} | ${OBJECTIVE_KIND_LABEL[objective.kind]} | ${objective.category} | ${cell(objective.text)} |`,
    );
  }
  lines.push("");

  lines.push(
    "## Diagrama con las respuestas óptimas",
    "",
    "Los casilleros tienen borde punteado.",
    "",
    "```mermaid",
  );
  lines.push(...flowchart(scenario, catalog), "```", "");

  lines.push("## Respuestas", "");
  for (const node of scenario.diagram.nodes) {
    if (node.type === "slot") lines.push(...slotSection(catalog, node));
  }

  if (scenario.references.length > 0) {
    lines.push("## Referencias", "");
    for (const reference of scenario.references) {
      lines.push(`- [${reference.title}](${reference.url})`);
    }
    lines.push("");
  }
  return finish(lines);
};

export const renderGeneratedFiles = (
  scenario: Scenario,
  catalog: Catalog,
): Record<GeneratedFileName, string> => ({
  "diagram.mmd": renderDiagram(scenario, catalog),
  "README.md": renderReadme(scenario, catalog),
});
