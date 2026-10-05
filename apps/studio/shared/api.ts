// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contract of the Studio API (ADR-0025 §4, S10): the server parses every request and response with
// these schemas, and the UI parses every response again. Shared by server/ and src/.
import { GENERATED_FILES } from "@blueprint/content-lint";
import {
  AreasFileSchema,
  BadgesFileSchema,
  CategoriesFileSchema,
  ConfusionGroupsFileSchema,
  GameRulesSchema,
  KEBAB_CASE,
  SCENARIO_STATUSES,
  ServicesFileSchema,
} from "@blueprint/scenario-schema";
import * as z from "zod";

/** Header that carries the session token on every /api request (S3). */
export const TOKEN_HEADER = "X-Studio-Token";
/** Meta tag of index.html where the server leaves the token for the UI (S3, S12). */
export const TOKEN_META = "studio-token";

/** Same rule as the `id` of a scenario in the schema: kebab-case, 3 to 64 characters (S5). */
export const ScenarioIdSchema = z.string().min(3).max(64).regex(KEBAB_CASE);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

/** sha256 of the bytes of scenario.yaml, in lowercase hex. */
export const HashSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const ScenarioSummarySchema = z.strictObject({
  id: ScenarioIdSchema,
  /** `null` when scenario.yaml does not parse or does not pass the schema. */
  title: z.string().nullable(),
  level: z.number().int().nullable(),
  status: z.enum(SCENARIO_STATUSES).nullable(),
  /** YAML, schema or lint errors (warnings do not count). */
  hasErrors: z.boolean(),
});
export type ScenarioSummary = z.infer<typeof ScenarioSummarySchema>;

export const ScenarioListResponseSchema = z.strictObject({
  scenarios: z.array(ScenarioSummarySchema),
});

export const ScenarioFileResponseSchema = z.strictObject({
  id: ScenarioIdSchema,
  /** scenario.yaml exactly as it is on disk. */
  yaml: z.string(),
  hash: HashSchema,
});
export type ScenarioFile = z.infer<typeof ScenarioFileResponseSchema>;

export const SaveRequestSchema = z.strictObject({
  yaml: z.string(),
  /**
   * Hash of the file as the UI read it. Optional only for the schema: a request without it is
   * answered with 409, like a stale one (S8).
   */
  baseHash: z.string().optional(),
});
export type SaveRequest = z.infer<typeof SaveRequestSchema>;

export const SaveResponseSchema = z.strictObject({
  hash: HashSchema,
  /** Generated files rewritten because their content changed. */
  regenerated: z.array(z.enum(GENERATED_FILES)),
});
export type SaveResponse = z.infer<typeof SaveResponseSchema>;

/** The shared content files, for the live validation in the browser. */
export const SharedResponseSchema = z.strictObject({
  catalog: ServicesFileSchema,
  categories: CategoriesFileSchema,
  confusionGroups: ConfusionGroupsFileSchema,
  areas: AreasFileSchema,
  gameRules: GameRulesSchema,
  badges: BadgesFileSchema,
});
export type SharedContent = z.infer<typeof SharedResponseSchema>;

export const ERROR_CODES = [
  /** S2: Host header other than 127.0.0.1:<port> or localhost:<port>. */
  "misdirected-request",
  /** S3: foreign or missing Origin, cross-site Sec-Fetch-Site or a wrong token. */
  "forbidden",
  /** S3: a body that is not application/json. */
  "unsupported-media-type",
  /** S6: body over 1 MiB. */
  "payload-too-large",
  /** S10: a request that does not match its schema. */
  "bad-request",
  /** S5: an id that is not a valid scenario id. */
  "invalid-id",
  /** S5: the scenario folder or file resolves outside content/scenarios/. */
  "outside-content",
  "not-found",
  /** S8: the file changed on disk since it was read, or the request has no base hash. */
  "conflict",
  /** S10: YAML with a syntax error, a scenario that fails the schema or an id that does not match. */
  "invalid-scenario",
  /** The shared files (catalog, game-rules, …) are missing or invalid. */
  "invalid-shared-content",
  "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.enum(ERROR_CODES),
    /** Spanish, shown to the author. */
    message: z.string(),
    /** Line of scenario.yaml the error points to, when there is one. */
    line: z.number().int().positive().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
