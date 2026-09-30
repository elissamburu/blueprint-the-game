// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseAreas, parseBadges, parseGameRules, type ParseResult } from "./index.js";

type Json = Record<string, unknown>;

const ok = <T>(result: ParseResult<T>): T => {
  if (!result.success)
    throw new Error(result.issues.map((i) => `${i.where}: ${i.message}`).join("\n"));
  return result.data;
};
const messages = <T>(result: ParseResult<T>): string[] =>
  result.success ? [] : result.issues.map((i) => `${i.where}: ${i.message}`);

describe("parseAreas", () => {
  it("accepts areas with optional description", () => {
    const areas = ok(
      parseAreas([
        { id: "serverless", name: "Serverless", description: "Cómputo sin servidores." },
        { id: "networking", name: "Redes" },
      ]),
    );
    expect(areas).toHaveLength(2);
  });

  it("rejects a missing name", () => {
    expect(messages(parseAreas([{ id: "data" }]))).toEqual([
      '[0] (data).name: Falta el campo obligatorio "name"',
    ]);
  });
});

// Initial values from docs/01 (RF-ONB-02, RF-EVAL-05, RF-GAM-01, RF-NAV-03, RF-PAL-01).
const gameRulesYaml = `
scoring:
  firstTryGreen: 100
  greenAfterErrors: { penaltyPerError: 25, min: 25 }
  acceptedAcceptable: 50
  hintCost: 15
  revealedSolution: 0
levelMultipliers: { 100: 1, 200: 1.5, 300: 2, 400: 3 }
ranks:
  - { id: aprendiz, name: Aprendiz, minXp: 0 }
  - { id: constructor, name: Constructor, minXp: 1000 }
  - { id: arquitecto, name: Arquitecto, minXp: 3000 }
  - { id: arquitecto-senior, name: Arquitecto Senior, minXp: 7000 }
  - { id: principal, name: Principal, minXp: 15000 }
unlock:
  scenariosRequired: 3
  byExperience:
    beginner: [100]
    aws-user: [100, 200]
    architect: [100, 200, 300]
    expert: [100, 200, 300, 400]
palette:
  modeByLevel: { 100: curated, 200: categories, 300: categories-plus, 400: full }
  defaultMaxSize: 12
`;

const gameRules = (): Json => parseYaml(gameRulesYaml) as Json;
const section = (rules: Json, ...keys: string[]): Json =>
  keys.reduce((node, key) => node[key] as Json, rules);

describe("parseGameRules", () => {
  it("accepts the initial game rules", () => {
    const rules = ok(parseGameRules(gameRules()));
    expect(rules.levelMultipliers["200"]).toBe(1.5);
    expect(rules.palette.modeByLevel["100"]).toBe("curated");
  });

  it("requires every level and every experience", () => {
    const rules = gameRules();
    delete section(rules, "levelMultipliers")["400"];
    delete section(rules, "unlock", "byExperience")["expert"];
    expect(messages(parseGameRules(rules))).toEqual([
      'levelMultipliers.400: Falta el campo obligatorio "400"',
      'unlock.byExperience.expert: Falta el campo obligatorio "expert"',
    ]);
  });

  it("requires the points of a viewed solution, never above solving the slot", () => {
    const missing = gameRules();
    delete section(missing, "scoring")["revealedSolution"];
    expect(messages(parseGameRules(missing))).toEqual([
      'scoring.revealedSolution: Falta el campo obligatorio "revealedSolution"',
    ]);

    const atLimit = gameRules();
    section(atLimit, "scoring")["revealedSolution"] = 25;
    expect(ok(parseGameRules(atLimit)).scoring.revealedSolution).toBe(25);

    const above = gameRules();
    section(above, "scoring")["revealedSolution"] = 26;
    expect(messages(parseGameRules(above))).toEqual([
      "scoring.revealedSolution: No puede ser mayor que acceptedAcceptable ni que greenAfterErrors.min (25): ver la solución nunca suma más que resolver el casillero",
    ]);

    const negative = gameRules();
    section(negative, "scoring")["revealedSolution"] = -1;
    expect(parseGameRules(negative).success).toBe(false);
  });

  it("rejects auto as the palette mode of a level", () => {
    const rules = gameRules();
    section(rules, "palette", "modeByLevel")["200"] = "auto";
    expect(messages(parseGameRules(rules))).toEqual([
      'palette.modeByLevel.200: modo de paleta "auto" no es válido: usá "curated", "categories", "categories-plus", "full"',
    ]);
  });
});

// Examples from ADR-0018 (revision 2026-09-28).
const badgesYaml = `
- id: primer-verde
  name: "Primer verde"
  description: "Completaste tu primer escenario."
  rule: { type: complete_count, count: 1 }
- id: serverless-300
  name: "Serverless 300"
  description: "Completaste 5 escenarios de nivel 300 del área serverless."
  rule: { type: complete_count, count: 5, level: 300, area: serverless }
- id: sin-red
  name: "Sin red"
  description: "Completaste un escenario de nivel 300 o más sin usar pistas."
  rule: { type: no_hints, minLevel: 300 }
- id: impecable
  name: "Impecable"
  description: "Completaste un escenario con todo verde al primer intento."
  rule: { type: perfect_scenario }
- id: constancia-7
  name: "Constancia"
  description: "Jugaste 7 días seguidos."
  rule: { type: streak, days: 7 }
- id: maestro-redes
  name: "Maestro de redes"
  description: "Completaste en verde el 80 % de los escenarios de redes."
  secret: true
  rule: { type: area_mastery, area: networking, percent: 80 }
- id: nivel-200
  name: "Nivel 200 completo"
  description: "Completaste todos los escenarios publicados de nivel 200."
  rule: { type: level_complete, level: 200 }
`;

describe("parseBadges", () => {
  it("accepts every rule type from ADR-0018", () => {
    const badges = ok(parseBadges(parseYaml(badgesYaml)));
    expect(badges.map((b) => b.rule.type)).toEqual([
      "complete_count",
      "complete_count",
      "no_hints",
      "perfect_scenario",
      "streak",
      "area_mastery",
      "level_complete",
    ]);
    expect(badges[0]?.secret).toBe(false);
    expect(badges[5]?.secret).toBe(true);
  });

  it("requires a description", () => {
    expect(
      messages(parseBadges([{ id: "x-1", name: "X", rule: { type: "perfect_scenario" } }])),
    ).toEqual(['[0] (x-1).description: Falta el campo obligatorio "description"']);
  });

  it("rejects rule types outside the closed set (first_of_kind was removed)", () => {
    const badge = { id: "x-1", name: "X", description: "X.", rule: { type: "first_of_kind" } };
    expect(messages(parseBadges([badge]))).toEqual([
      '[0] (x-1).rule.type: rule.type "first_of_kind" no es válido: usá "complete_count", "perfect_scenario", "no_hints", "streak", "area_mastery", "level_complete"',
    ]);
  });

  it("reports a missing rule type and invalid rule parameters", () => {
    const badges = [
      { id: "a-1", name: "A", description: "A.", rule: { count: 1 } },
      { id: "b-1", name: "B", description: "B.", rule: { type: "level_complete", level: 250 } },
      {
        id: "c-1",
        name: "C",
        description: "C.",
        rule: { type: "area_mastery", area: "data", percent: 120 },
      },
    ];
    expect(messages(parseBadges(badges))).toEqual([
      '[0] (a-1).rule.type: Falta el campo obligatorio "type": usá "complete_count", "perfect_scenario", "no_hints", "streak", "area_mastery", "level_complete"',
      "[1] (b-1).rule.level: El nivel 250 no existe: tiene que ser 100, 200, 300 o 400",
      "[2] (c-1).rule.percent: Tiene que ser como máximo 100",
    ]);
  });
});
