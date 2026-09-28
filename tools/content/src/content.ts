// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reads content/ from disk and parses it with @blueprint/scenario-schema (docs/03 §1).
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  parseAreas,
  parseBadges,
  parseCategories,
  parseConfusionGroups,
  parseGameRules,
  parseScenario,
  parseServices,
  type Area,
  type Badge,
  type Category,
  type ConfusionGroup,
  type GameRules,
  type ParseResult,
  type Scenario,
  type Service,
} from "@blueprint/scenario-schema";
import { parseDocument } from "yaml";
import { fromSchemaIssues, type Finding } from "./findings.js";

export const SCENARIOS_DIR = "scenarios";
export const SCENARIO_FILE = "scenario.yaml";

export const toPosix = (value: string): string => value.split(path.sep).join("/");

/** Path shown to authors: relative to the parent of the content dir (`content/...`). */
export const displayPath = (contentDir: string, file: string): string =>
  toPosix(path.relative(path.dirname(path.resolve(contentDir)), path.resolve(file)));

const isNotFound = (error: unknown): boolean =>
  error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR");

/** File content, or `undefined` when it does not exist. Other IO errors propagate. */
export const readTextIfExists = async (file: string): Promise<string | undefined> => {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
};

export const isDirectory = async (dir: string): Promise<boolean> => {
  try {
    return (await stat(dir)).isDirectory();
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
};

export type YamlResult = { ok: true; value: unknown } | { ok: false; findings: Finding[] };

/** Parses YAML text; syntax errors become YAML findings with line and column. */
export const parseYaml = (text: string, file: string): YamlResult => {
  const document = parseDocument(text, { prettyErrors: true });
  if (document.errors.length > 0) {
    return {
      ok: false,
      findings: document.errors.map((error) => ({
        code: "YAML",
        severity: "error",
        message: `YAML inválido: ${(error.message.split("\n")[0] ?? "").replace(/:$/, "")}`,
        file,
      })),
    };
  }
  return { ok: true, value: document.toJS() };
};

/** Parses YAML and validates it with a scenario-schema parse function. */
export const parseContentFile = <T>(
  text: string,
  file: string,
  parse: (input: unknown) => ParseResult<T>,
): { data?: T; raw?: unknown; findings: Finding[] } => {
  const yaml = parseYaml(text, file);
  if (!yaml.ok) return { findings: yaml.findings };
  const result = parse(yaml.value);
  return result.success
    ? { data: result.data, raw: yaml.value, findings: [] }
    : { raw: yaml.value, findings: fromSchemaIssues(file, result.issues) };
};

interface SharedFileSpec<T> {
  /** Segments relative to the content dir. */
  segments: readonly string[];
  /** What the file holds, for the "missing file" message. */
  contains: string;
  parse: (input: unknown) => ParseResult<T>;
}

const SHARED_FILES = {
  services: {
    segments: ["catalog", "services.yaml"],
    contains:
      "el catálogo curado de servicios de AWS que usan los escenarios (id, nombre, categoría, patrones de filtración y descripción corta)",
    parse: parseServices,
  },
  categories: {
    segments: ["catalog", "categories.yaml"],
    contains: "las categorías de servicios y sus adyacencias (modo de paleta categories-plus)",
    parse: parseCategories,
  },
  confusionGroups: {
    segments: ["catalog", "confusion-groups.yaml"],
    contains:
      "los grupos de servicios que suelen confundirse (distractores de la paleta curated)",
    parse: parseConfusionGroups,
  },
  areas: {
    segments: ["areas.yaml"],
    contains: "las áreas de interés a las que pertenecen los escenarios (serverless, data, …)",
    parse: parseAreas,
  },
  gameRules: {
    segments: ["game-rules.yaml"],
    contains:
      "las reglas de juego: puntajes, multiplicadores por nivel, rangos, desbloqueos y modos de paleta",
    parse: parseGameRules,
  },
  badges: {
    segments: ["badges", "badges.yaml"],
    contains: "las insignias declarativas",
    parse: parseBadges,
  },
} as const satisfies Record<string, SharedFileSpec<unknown>>;

export type SharedFileKey = keyof typeof SHARED_FILES;

export const SHARED_FILE_PATHS: readonly string[] = Object.values(SHARED_FILES).map((spec) =>
  spec.segments.join("/"),
);

/** Display path of a shared file (`content/catalog/services.yaml`). */
export const sharedFileDisplay = (contentDir: string, key: SharedFileKey): string =>
  displayPath(contentDir, path.join(contentDir, ...SHARED_FILES[key].segments));

const loadShared = async <T>(
  contentDir: string,
  spec: SharedFileSpec<T>,
): Promise<{ data?: T; raw?: unknown; findings: Finding[] }> => {
  const file = path.join(contentDir, ...spec.segments);
  const display = displayPath(contentDir, file);
  const text = await readTextIfExists(file);
  if (text === undefined) {
    return {
      findings: [
        {
          code: "FILE",
          severity: "error",
          message: `Falta el archivo obligatorio ${display}: contiene ${spec.contains}. Ver docs/03-modelo-de-escenarios.md.`,
          file: display,
        },
      ],
    };
  }
  const { data, raw, findings } = parseContentFile(text, display, spec.parse);
  return data === undefined ? { findings } : { data, raw, findings };
};

export interface SharedContent {
  services?: Service[];
  categories?: Category[];
  confusionGroups?: ConfusionGroup[];
  areas?: Area[];
  gameRules?: GameRules;
  badges?: Badge[];
}

/** Deserialized YAML of each valid shared file, used to annotate paths with ids. */
export type SharedRaw = Partial<Record<SharedFileKey, unknown>>;

/** Loads the files every scenario depends on. Missing or invalid files yield findings. */
export const loadSharedContent = async (
  contentDir: string,
): Promise<{ shared: SharedContent; raw: SharedRaw; findings: Finding[] }> => {
  const [services, categories, confusionGroups, areas, gameRules, badges] = await Promise.all([
    loadShared(contentDir, SHARED_FILES.services),
    loadShared(contentDir, SHARED_FILES.categories),
    loadShared(contentDir, SHARED_FILES.confusionGroups),
    loadShared(contentDir, SHARED_FILES.areas),
    loadShared(contentDir, SHARED_FILES.gameRules),
    loadShared(contentDir, SHARED_FILES.badges),
  ]);
  const shared: SharedContent = {};
  if (services.data !== undefined) shared.services = services.data;
  if (categories.data !== undefined) shared.categories = categories.data;
  if (confusionGroups.data !== undefined) shared.confusionGroups = confusionGroups.data;
  if (areas.data !== undefined) shared.areas = areas.data;
  if (gameRules.data !== undefined) shared.gameRules = gameRules.data;
  if (badges.data !== undefined) shared.badges = badges.data;
  const raw: SharedRaw = {
    services: services.raw,
    categories: categories.raw,
    confusionGroups: confusionGroups.raw,
    areas: areas.raw,
    gameRules: gameRules.raw,
    badges: badges.raw,
  };
  const findings = [services, categories, confusionGroups, areas, gameRules, badges].flatMap(
    (result) => result.findings,
  );
  return { shared, raw, findings };
};

/**
 * Scenario folder names, sorted. Folders starting with `_` are not scenarios (templates,
 * fixtures). `undefined` when content/scenarios does not exist.
 */
export const listScenarioIds = async (contentDir: string): Promise<string[] | undefined> => {
  const dir = path.join(contentDir, SCENARIOS_DIR);
  if (!(await isDirectory(dir))) return undefined;
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();
};

export interface LoadedScenario {
  /** Folder name (content/scenarios/<id>/). */
  id: string;
  dir: string;
  /** Display path of scenario.yaml. */
  file: string;
  scenario?: Scenario;
  /** Deserialized YAML, used to annotate paths with ids. */
  raw?: unknown;
  findings: Finding[];
}

export const scenarioDir = (contentDir: string, id: string): string =>
  path.join(contentDir, SCENARIOS_DIR, id);

export const loadScenario = async (contentDir: string, id: string): Promise<LoadedScenario> => {
  const dir = scenarioDir(contentDir, id);
  const filePath = path.join(dir, SCENARIO_FILE);
  const file = displayPath(contentDir, filePath);
  const text = await readTextIfExists(filePath);
  if (text === undefined) {
    return {
      id,
      dir,
      file,
      findings: [
        {
          code: "FILE",
          severity: "error",
          message: `La carpeta ${displayPath(contentDir, dir)} no tiene ${SCENARIO_FILE}: cada carpeta de content/scenarios es un escenario (las que empiezan con "_" se ignoran).`,
          file,
        },
      ],
    };
  }
  const { data, raw, findings } = parseContentFile(text, file, parseScenario);
  const loaded: LoadedScenario = { id, dir, file, findings };
  if (data !== undefined) loaded.scenario = data;
  if (raw !== undefined) loaded.raw = raw;
  return loaded;
};
