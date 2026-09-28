// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { edgePath, groupPath, nodePath, slotsOf } from "../scenario-helpers.js";
import type { Issue, IssuePath, Rule } from "../types.js";

interface TextField {
  path: IssuePath;
  text: string;
}

/** Texts visible before the player places a service (docs/03 §3, L005). */
export const visibleTexts = (scenario: Scenario): TextField[] => {
  const fields: TextField[] = [
    { path: ["title"], text: scenario.title },
    { path: ["summary"], text: scenario.summary },
    { path: ["context"], text: scenario.context },
    ...scenario.objectives.map((objective, i) => ({
      path: ["objectives", i, "text"],
      text: objective.text,
    })),
    ...scenario.diagram.groups.map((group, i) => ({
      path: [...groupPath(i), "label"],
      text: group.label,
    })),
  ];
  scenario.diagram.nodes.forEach((node, i) => {
    if (node.type === "actor" || node.type === "external") {
      fields.push({ path: [...nodePath(i), "label"], text: node.label });
    } else if (node.type === "slot") {
      fields.push({ path: [...nodePath(i), "role"], text: node.role });
      node.hints.forEach((hint, k) =>
        fields.push({ path: [...nodePath(i), "hints", k], text: hint }),
      );
    }
  });
  scenario.diagram.edges.forEach((edge, i) => {
    fields.push({ path: [...edgePath(i), "label"], text: edge.label });
    if (edge.description !== undefined) {
      fields.push({ path: [...edgePath(i), "description"], text: edge.description });
    }
  });
  return fields;
};

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Case-insensitive match on word boundaries that understand accents and ñ: a pattern
 * matches only when not preceded or followed by a letter, digit or `_` (`\b` is ASCII-only).
 * Whitespace inside a pattern matches any whitespace run, so line breaks in markdown count.
 */
export const leakRegExp = (pattern: string): RegExp => {
  const body = pattern.trim().split(/\s+/u).map(escapeRegExp).join("\\s+");
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, "iu");
};

const firstMatch = (service: Service, text: string): string | undefined => {
  for (const pattern of service.leakPatterns) {
    const match = leakRegExp(pattern).exec(text);
    if (match !== null) return match[0];
  }
  return undefined;
};

/**
 * Error: naming an answer (optimal or acceptable) of any slot.
 * Warning: naming an `incorrect` or `palette.extra` service (leaks by elimination).
 * Services of fixed nodes are already visible and never count; other services are free.
 */
export const l005: Rule = {
  code: "L005",
  description: "Sin filtraciones de servicios ocultos en los textos visibles.",
  check: ({ scenario, servicesById }) => {
    const fixed = new Set(
      scenario.diagram.nodes.flatMap((node) => (node.type === "fixed" ? [node.service] : [])),
    );
    const answerSlot = new Map<string, string>();
    const distractors = new Set<string>();
    for (const { slot } of slotsOf(scenario)) {
      for (const answer of slot.answers) {
        if (!answerSlot.has(answer.service)) answerSlot.set(answer.service, slot.id);
      }
      for (const incorrect of slot.incorrect) distractors.add(incorrect.service);
    }
    for (const extra of scenario.palette?.extra ?? []) distractors.add(extra);

    const watched: { service: Service; slot: string | undefined }[] = [];
    for (const [id, slot] of answerSlot) {
      const service = servicesById.get(id);
      if (service !== undefined && !fixed.has(id)) watched.push({ service, slot });
    }
    for (const id of distractors) {
      const service = servicesById.get(id);
      if (service !== undefined && !fixed.has(id) && !answerSlot.has(id)) {
        watched.push({ service, slot: undefined });
      }
    }

    return visibleTexts(scenario).flatMap(({ path, text }) =>
      watched.flatMap(({ service, slot }): Issue[] => {
        const match = firstMatch(service, text);
        if (match === undefined) return [];
        return [
          slot === undefined
            ? {
                code: "L005",
                severity: "warning",
                message: `El texto nombra "${match}" (${service.name}), un distractor del escenario (incorrect o palette.extra): delata respuestas por eliminación. Si es intencional, dejalo; si no, reformulalo.`,
                path,
              }
            : {
                code: "L005",
                severity: "error",
                message: `El texto nombra "${match}", que delata ${service.name}, respuesta del casillero "${slot}". Reformulalo sin nombrar el servicio.`,
                path,
              },
        ];
      }),
    );
  },
};
