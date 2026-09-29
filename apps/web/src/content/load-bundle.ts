// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Loads the content:build bundle at runtime (ADR-0006). It is served as static files, never
// imported into the JS, and every file is validated with the scenario-schema schemas before
// the game uses it.
import {
  listedStatuses,
  parseBundleCatalog,
  parseBundleIndex,
  parseGameRules,
  parseScenario,
  type BundleCatalog,
  type BundleIndex,
  type BundleIndexEntry,
  type GameRules,
  type ParseResult,
  type Scenario,
  type SchemaIssue,
} from "@blueprint/scenario-schema";

export interface ContentBundle {
  /** Listing of the scenarios the player can see (see `listedStatuses`). */
  readonly index: BundleIndex;
  readonly catalog: BundleCatalog;
  readonly rules: GameRules;
}

export type ContentLoadError =
  | { readonly kind: "network"; readonly file: string; readonly detail: string }
  | { readonly kind: "invalid-json"; readonly file: string }
  | { readonly kind: "invalid"; readonly file: string; readonly issues: readonly SchemaIssue[] }
  /** The scenario file parses but is another scenario or version than its index entry. */
  | { readonly kind: "mismatch"; readonly file: string; readonly id: string; readonly version: number };

export type LoadResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ContentLoadError };

export interface LoadOptions {
  /** URL of the bundle directory, ending in "/". */
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
  /**
   * List drafts too. Only in development (pnpm dev:web builds the bundle with
   * --include-drafts); production lists published and beta only (RF-NAV-05).
   */
  readonly includeDrafts: boolean;
}

const fetchJson = async (
  file: string,
  options: Pick<LoadOptions, "baseUrl" | "fetch">,
): Promise<LoadResult<unknown>> => {
  let response: Response;
  try {
    response = await options.fetch(`${options.baseUrl}${file}`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, error: { kind: "network", file, detail } };
  }
  if (!response.ok) {
    const detail = `HTTP ${response.status}`;
    return { ok: false, error: { kind: "network", file, detail } };
  }
  try {
    return { ok: true, value: (await response.json()) as unknown };
  } catch {
    return { ok: false, error: { kind: "invalid-json", file } };
  }
};

const validated = <T>(file: string, result: ParseResult<T>): LoadResult<T> =>
  result.success
    ? { ok: true, value: result.data }
    : { ok: false, error: { kind: "invalid", file, issues: result.issues } };

const loadFile = async <T>(
  file: string,
  parse: (input: unknown) => ParseResult<T>,
  options: LoadOptions,
): Promise<LoadResult<T>> => {
  const raw = await fetchJson(file, options);
  return raw.ok ? validated(file, parse(raw.value)) : raw;
};

/** Loads and validates index.json, catalog.json and game-rules.json. */
export const loadContentBundle = async (
  options: LoadOptions,
): Promise<LoadResult<ContentBundle>> => {
  const [index, catalog, rules] = await Promise.all([
    loadFile("index.json", parseBundleIndex, options),
    loadFile("catalog.json", parseBundleCatalog, options),
    loadFile("game-rules.json", parseGameRules, options),
  ]);
  if (!index.ok) return index;
  if (!catalog.ok) return catalog;
  if (!rules.ok) return rules;
  const listed = listedStatuses(options.includeDrafts);
  return {
    ok: true,
    value: {
      index: {
        ...index.value,
        scenarios: index.value.scenarios.filter((entry) => listed.has(entry.status)),
      },
      catalog: catalog.value,
      rules: rules.value,
    },
  };
};

/** Loads and validates the full scenario of an index entry. */
export const loadScenario = async (
  entry: Pick<BundleIndexEntry, "id" | "version" | "file">,
  options: LoadOptions,
): Promise<LoadResult<Scenario>> => {
  const result = await loadFile(entry.file, parseScenario, options);
  if (!result.ok) return result;
  if (result.value.id !== entry.id || result.value.version !== entry.version) {
    return {
      ok: false,
      error: { kind: "mismatch", file: entry.file, id: entry.id, version: entry.version },
    };
  }
  return result;
};
