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
  MAX_LENGTH,
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
  /** notes.md of the scenario folder, or `null` when there is none (it goes in the .zip). */
  notes: z.string().nullable(),
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
  /**
   * A draft saved although it fails the schema: diagram.mmd and README.md were not regenerated
   * (ADR-0025, S10 as amended on 2026-10-05).
   */
  generatedSkipped: z.boolean(),
});
export type SaveResponse = z.infer<typeof SaveResponseSchema>;

/**
 * Templates of content/scenarios/_templates/ a scenario can be created from: a closed list (S5),
 * each one the file `<name>.template.yaml`.
 */
export const TEMPLATE_NAMES = ["scenario"] as const;
export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const CREATE_SOURCES = ["empty", "template", "duplicate"] as const;
export type CreateSource = (typeof CREATE_SOURCES)[number];

const NewTitleSchema = z.string().trim().min(1).max(MAX_LENGTH.title);

/**
 * POST /api/scenarios (RF-STU-01): a new scenario `id`, empty, from a template or duplicating the
 * scenario `from`. The server never takes YAML here: it writes its own text (S10).
 */
export const CreateRequestSchema = z.discriminatedUnion("source", [
  z.strictObject({ id: ScenarioIdSchema, title: NewTitleSchema, source: z.literal("empty") }),
  z.strictObject({
    id: ScenarioIdSchema,
    title: NewTitleSchema,
    source: z.literal("template"),
    from: z.enum(TEMPLATE_NAMES),
  }),
  z.strictObject({
    id: ScenarioIdSchema,
    title: NewTitleSchema,
    source: z.literal("duplicate"),
    from: ScenarioIdSchema,
  }),
]);
export type CreateRequest = z.infer<typeof CreateRequestSchema>;

export const CreateResponseSchema = z.strictObject({
  id: ScenarioIdSchema,
  /** GitHub user written in `authors`, or `null` when the git config has none (the UI asks). */
  author: z.string().nullable(),
  /** Generated files written: none when the new scenario does not pass the schema yet. */
  generated: z.array(z.enum(GENERATED_FILES)),
});
export type CreateResponse = z.infer<typeof CreateResponseSchema>;

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
  /** S3: foreign or missing Origin, or cross-site Sec-Fetch-Site. */
  "forbidden",
  /**
   * S3: a missing or wrong session token, e.g. the page was loaded before the server restarted:
   * only reloading the page gets the new one.
   */
  "invalid-token",
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
  /**
   * S8: the file changed on disk since it was read, the request has no base hash, or the folder of
   * a new scenario already exists.
   */
  "conflict",
  /**
   * S10: YAML with a syntax error, a scenario that is not a draft and fails the schema, or an id
   * that does not match; when creating, a source scenario whose YAML cannot be read.
   */
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
