// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Structural schemas of content/areas.yaml, content/game-rules.yaml and
// content/badges/badges.yaml (docs/03 §6, ADR-0018).
import * as z from "zod";
import {
  CONCRETE_PALETTE_MODES,
  discriminatorMessage,
  kebabId,
  level,
  oneOf,
  positiveInt,
  text,
} from "./common.js";

export const AreaSchema = z.strictObject({
  id: kebabId(),
  name: text(),
  description: text().optional(),
});

export const AreasFileSchema = z.array(AreaSchema);

const nonNegativeInt = () => z.int().nonnegative();

/** One value per scenario level; YAML integer keys arrive as strings. */
const perLevel = <T extends z.ZodType>(value: T) =>
  z.record(z.enum(["100", "200", "300", "400"]), value);

export const EXPERIENCES = ["beginner", "aws-user", "architect", "expert"] as const;

export const GameRulesSchema = z.strictObject({
  scoring: z
    .strictObject({
      firstTryGreen: nonNegativeInt().describe("Puntos por verde al primer intento."),
      greenAfterErrors: z
        .strictObject({
          penaltyPerError: nonNegativeInt(),
          min: nonNegativeInt(),
        })
        .describe("Verde tras N errores: max(min, firstTryGreen − penaltyPerError·N)."),
      acceptedAcceptable: nonNegativeInt().describe("Puntos por un naranja aceptado."),
      hintCost: nonNegativeInt().describe("Puntos que resta cada pista (el mínimo es 0)."),
      revealedSolution: nonNegativeInt().describe(
        "Puntos de un casillero con la solución vista (RF-PLAY-14). Nunca más que resolverlo.",
      ),
    })
    // Viewing the solution never pays more than solving the slot: not more than an accepted
    // orange nor than the worst green (RF-PLAY-14, ADR-0024).
    .check((ctx) => {
      const { revealedSolution, acceptedAcceptable, greenAfterErrors } = ctx.value;
      const limit = Math.min(acceptedAcceptable, greenAfterErrors.min);
      if (revealedSolution > limit) {
        ctx.issues.push({
          code: "custom",
          input: revealedSolution,
          path: ["revealedSolution"],
          message: `No puede ser mayor que acceptedAcceptable ni que greenAfterErrors.min (${limit}): ver la solución nunca suma más que resolver el casillero`,
        });
      }
    }),
  levelMultipliers: perLevel(z.number().positive()),
  ranks: z
    .array(
      z.strictObject({
        id: kebabId(),
        name: text(),
        minXp: nonNegativeInt(),
      }),
    )
    .min(1, { error: "Tiene que haber al menos un rango" }),
  unlock: z.strictObject({
    scenariosRequired: positiveInt().describe(
      "Escenarios del nivel N a completar para desbloquear N+1.",
    ),
    byExperience: z.record(z.enum(EXPERIENCES), z.array(level()).min(1)),
  }),
  palette: z.strictObject({
    modeByLevel: perLevel(oneOf(CONCRETE_PALETTE_MODES, "modo de paleta")),
    defaultMaxSize: positiveInt(),
  }),
});

export const BADGE_RULE_TYPES = [
  "complete_count",
  "perfect_scenario",
  "no_hints",
  "streak",
  "area_mastery",
  "level_complete",
] as const;

/** Closed set of badge rule types implemented by game-engine (ADR-0018). */
export const BadgeRuleSchema = z.discriminatedUnion(
  "type",
  [
    z.strictObject({
      type: z.literal("complete_count"),
      count: positiveInt(),
      level: level().optional(),
      area: kebabId().optional(),
    }),
    z.strictObject({ type: z.literal("perfect_scenario") }),
    z.strictObject({ type: z.literal("no_hints"), minLevel: level().optional() }),
    z.strictObject({ type: z.literal("streak"), days: positiveInt() }),
    z.strictObject({
      type: z.literal("area_mastery"),
      area: kebabId(),
      percent: z.number().gt(0).lte(100),
    }),
    z.strictObject({ type: z.literal("level_complete"), level: level() }),
  ],
  {
    error: (iss) => discriminatorMessage(iss.input, "type", "rule.type", BADGE_RULE_TYPES),
  },
);

export const BadgeSchema = z.strictObject({
  id: kebabId(),
  name: text(),
  description: text(),
  secret: z.boolean().default(false),
  rule: BadgeRuleSchema,
});

export const BadgesFileSchema = z.array(BadgeSchema);

export type Area = z.infer<typeof AreaSchema>;
export type GameRules = z.infer<typeof GameRulesSchema>;
export type Experience = (typeof EXPERIENCES)[number];
export type BadgeRule = z.infer<typeof BadgeRuleSchema>;
export type BadgeRuleType = BadgeRule["type"];
export type Badge = z.infer<typeof BadgeSchema>;
