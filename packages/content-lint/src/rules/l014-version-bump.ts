// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Scenario } from "@blueprint/scenario-schema";
import type { Issue } from "../types.js";

const sortedUnique = (values: readonly string[]): string[] => [...new Set(values)].sort();

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i]);

interface SlotFingerprint {
  answers: string[];
  incorrect: string[];
}

const slotFingerprints = (scenario: Scenario): Map<string, SlotFingerprint> =>
  new Map(
    scenario.diagram.nodes.flatMap((node) =>
      node.type === "slot"
        ? [
            [
              node.id,
              {
                answers: sortedUnique(node.answers.map((a) => `${a.service} (${a.grade})`)),
                incorrect: sortedUnique(node.incorrect.map((i) => i.service)),
              },
            ] as const,
          ]
        : [],
    ),
  );

const paletteFingerprint = (scenario: Scenario): string => {
  const palette = scenario.palette;
  const maxSize = palette !== undefined && "maxSize" in palette ? palette.maxSize : undefined;
  return JSON.stringify({
    mode: palette?.mode ?? "auto",
    maxSize: maxSize ?? null,
    extra: sortedUnique(palette?.extra ?? []),
  });
};

/**
 * Changes that alter the result of an attempt (grades) or the conditions of play (level,
 * resulting palette). Texts, order, hints, references and positions do not count.
 */
export const gameplayChanges = (base: Scenario, head: Scenario): string[] => {
  const changes: string[] = [];
  if (base.level !== head.level) changes.push(`level ${base.level} → ${head.level}`);
  if (paletteFingerprint(base) !== paletteFingerprint(head)) {
    changes.push("palette (mode, maxSize o extra)");
  }
  const before = slotFingerprints(base);
  const after = slotFingerprints(head);
  for (const [id, slot] of before) {
    const now = after.get(id);
    if (now === undefined) {
      changes.push(`se quitó el casillero "${id}"`);
      continue;
    }
    if (!sameList(slot.answers, now.answers)) changes.push(`answers o grados de "${id}"`);
    if (!sameList(slot.incorrect, now.incorrect)) changes.push(`incorrect de "${id}"`);
  }
  for (const id of after.keys()) {
    if (!before.has(id)) changes.push(`se agregó el casillero "${id}"`);
  }
  return changes;
};

/**
 * L014: compares the scenario on main (`base`, undefined when it is new) with the branch
 * (`head`). Applies when it exists on main with a status other than draft: beta and
 * published grant XP and retired keeps historical progress. Pure: the CLI reads main.
 */
export const checkVersionBump = (base: Scenario | undefined, head: Scenario): Issue[] => {
  if (base === undefined || base.status === "draft" || head.version > base.version) return [];
  const changes = gameplayChanges(base, head);
  if (changes.length === 0) return [];
  return [
    {
      code: "L014",
      severity: "error",
      message: `El escenario está ${base.status} en main y cambió lo que define el resultado o las condiciones de juego (${changes.join("; ")}): incrementá version (en main es ${base.version}, en la rama ${head.version}).`,
      path: ["version"],
    },
  ];
};
