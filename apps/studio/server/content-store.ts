// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the API does with content/: list and read scenarios, save one (S7, S8, S10) regenerating
// diagram.mmd and README.md, create one (RF-STU-01: empty, from a template or duplicating another;
// S8) and read the shared files. Every path goes through ScenarioPaths (S5). There is no operation
// to delete or rename (S8).
import { createHash } from "node:crypto";
import path from "node:path";
import {
  GENERATED_FILES,
  renderGeneratedFiles,
  type GeneratedFileName,
} from "@blueprint/content-lint";
import {
  parseAreas,
  parseBadges,
  parseCategories,
  parseConfusionGroups,
  parseGameRules,
  parseServices,
  type ParseResult,
  type Scenario,
} from "@blueprint/scenario-schema";
import { parse } from "yaml";
import { EditError } from "../shared/document-edit.js";
import {
  ScenarioIdSchema,
  type CreateRequest,
  type CreateResponse,
  type SaveResponse,
  type ScenarioFile,
  type ScenarioSummary,
  type SharedContent,
} from "../shared/api.js";
import { validateScenarioText } from "../shared/validation.js";
import { writeFileAtomic } from "./atomic-write.js";
import { StudioError } from "./errors.js";
import { isNotFound, type ContentFs } from "./fs.js";
import { readGitHubUser } from "./git-config.js";
import { EMPTY_SCENARIO, newScenarioText } from "./new-scenario.js";
import { createScenarioPaths } from "./paths.js";

export const sha256 = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

const sameText = (a: string, b: string): boolean =>
  a.replace(/\r\n/g, "\n") === b.replace(/\r\n/g, "\n");

const SHARED_FILES = {
  catalog: { segments: ["catalog", "services.yaml"], parse: parseServices },
  categories: { segments: ["catalog", "categories.yaml"], parse: parseCategories },
  confusionGroups: { segments: ["catalog", "confusion-groups.yaml"], parse: parseConfusionGroups },
  areas: { segments: ["areas.yaml"], parse: parseAreas },
  gameRules: { segments: ["game-rules.yaml"], parse: parseGameRules },
  badges: { segments: ["badges", "badges.yaml"], parse: parseBadges },
} as const;

export interface ContentStore {
  listScenarios: () => Promise<ScenarioSummary[]>;
  readScenario: (id: string) => Promise<ScenarioFile>;
  saveScenario: (id: string, yaml: string, baseHash: string | undefined) => Promise<SaveResponse>;
  createScenario: (request: CreateRequest) => Promise<CreateResponse>;
  readShared: () => Promise<SharedContent>;
}

export const createContentStore = ({
  fs,
  contentDir,
  gitConfigFiles = [],
}: {
  fs: ContentFs;
  contentDir: string;
  /** Git config files with the author of new scenarios, the later overriding the earlier. */
  gitConfigFiles?: readonly string[];
}): ContentStore => {
  const paths = createScenarioPaths(fs, contentDir);
  /**
   * Writes run one after the other, so the hash check and the write of a save, or the creation of
   * a scenario, never interleave with another write.
   */
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task);
    queue = run.catch(() => undefined);
    return run;
  };

  const readSharedFile = async <T>(
    segments: readonly string[],
    parseFile: (input: unknown) => ParseResult<T>,
  ): Promise<T> => {
    const display = ["content", ...segments].join("/");
    const invalid = (reason: string) =>
      new StudioError(
        500,
        "invalid-shared-content",
        `${display} ${reason}: corré pnpm content:validate para ver el detalle.`,
      );
    let text: string;
    try {
      text = await fs.readFile(path.join(contentDir, ...segments), "utf8");
    } catch (error) {
      if (isNotFound(error)) throw invalid("no existe");
      throw error;
    }
    let raw: unknown;
    try {
      raw = parse(text);
    } catch {
      throw invalid("no es un YAML válido");
    }
    const result = parseFile(raw);
    if (!result.success) throw invalid("no pasa el schema");
    return result.data;
  };

  const readShared = async (): Promise<SharedContent> => {
    const { catalog, categories, confusionGroups, areas, gameRules, badges } = SHARED_FILES;
    const [c, cat, groups, a, rules, b] = await Promise.all([
      readSharedFile(catalog.segments, catalog.parse),
      readSharedFile(categories.segments, categories.parse),
      readSharedFile(confusionGroups.segments, confusionGroups.parse),
      readSharedFile(areas.segments, areas.parse),
      readSharedFile(gameRules.segments, gameRules.parse),
      readSharedFile(badges.segments, badges.parse),
    ]);
    return {
      catalog: c,
      categories: cat,
      confusionGroups: groups,
      areas: a,
      gameRules: rules,
      badges: b,
    };
  };

  const readExisting = async (id: string) => {
    const file = await paths.file(id, "scenario.yaml");
    if (!file.exists) {
      throw new StudioError(404, "not-found", `El escenario "${id}" no tiene scenario.yaml.`);
    }
    const bytes = await fs.readFile(file.path);
    return { path: file.path, bytes };
  };

  const listScenarios = async (): Promise<ScenarioSummary[]> => {
    let entries;
    try {
      entries = await fs.readdir(paths.scenariosDir, { withFileTypes: true });
    } catch (error) {
      if (isNotFound(error)) return [];
      throw error;
    }
    // Lint needs the shared files; without them the list still shows YAML and schema errors.
    const shared = await readShared().catch(() => undefined);
    // Only real folders with a valid id: templates (`_…`), symlinks and junctions are not listed.
    const ids = entries
      .filter((entry) => entry.isDirectory() && ScenarioIdSchema.safeParse(entry.name).success)
      .map((entry) => entry.name)
      .sort();
    const summaries: ScenarioSummary[] = [];
    for (const id of ids) {
      let text: string;
      try {
        text = (await readExisting(id)).bytes.toString("utf8");
      } catch (error) {
        if (error instanceof StudioError) continue;
        throw error;
      }
      const result = shared === undefined ? undefined : validateScenarioText(text, id, shared);
      const scenario = result?.scenario;
      summaries.push({
        id,
        title: scenario?.title ?? null,
        level: scenario?.level ?? null,
        status: scenario?.status ?? null,
        hasErrors:
          result === undefined || result.findings.some((finding) => finding.severity === "error"),
      });
    }
    return summaries;
  };

  const readScenario = async (id: string): Promise<ScenarioFile> => {
    const { bytes } = await readExisting(id);
    const notes = await paths.file(id, "notes.md");
    return {
      id,
      yaml: bytes.toString("utf8"),
      hash: sha256(bytes),
      notes: notes.exists ? await fs.readFile(notes.path, "utf8") : null,
    };
  };

  /** Writes the generated files that are missing or out of date; returns the ones written. */
  const writeGenerated = async (
    id: string,
    scenario: Scenario,
    shared: SharedContent,
  ): Promise<GeneratedFileName[]> => {
    const catalog = new Map(shared.catalog.map((service) => [service.id, service]));
    const generated = renderGeneratedFiles(scenario, catalog);
    const written: GeneratedFileName[] = [];
    for (const name of GENERATED_FILES) {
      const file = await paths.file(id, name);
      const actual = file.exists ? await fs.readFile(file.path, "utf8") : undefined;
      // Like pnpm content:gen: an up-to-date file is not rewritten, so its bytes do not change.
      if (actual !== undefined && sameText(actual, generated[name])) continue;
      await writeFileAtomic(fs, file.path, generated[name]);
      written.push(name);
    }
    return written;
  };

  const save = async (
    id: string,
    yaml: string,
    baseHash: string | undefined,
  ): Promise<SaveResponse> => {
    const current = await readExisting(id);
    // S8: never overwrite blindly. Without the hash of what the author opened, or with an old
    // one, the file is left as it is. The messages of a failed save say why, not that it failed:
    // the UI already says so.
    if (baseHash === undefined || baseHash !== sha256(current.bytes)) {
      throw new StudioError(
        409,
        "conflict",
        "El archivo cambió en disco desde que lo abriste: no se guardó para no pisar esos cambios.",
      );
    }
    const shared = await readShared();
    // S10: revalidate YAML, schema and id before writing anything. Lint findings do not block
    // saving, and a draft that parses is saved even if it fails the schema (ADR-0025, S10 as
    // amended on 2026-10-05): the author does not lose the work while it is being fixed.
    const validation = validateScenarioText(yaml, id, shared);
    const { scenario, header } = validation;
    const first = validation.findings[0];
    if (scenario === undefined && (validation.stage === "yaml" || header?.status !== "draft")) {
      const where = first !== undefined && first.where !== "" ? ` (${first.where})` : "";
      throw new StudioError(
        422,
        "invalid-scenario",
        `${first?.message ?? "El escenario no es válido"}${where}.`,
        first?.line,
      );
    }
    const writtenId = scenario?.id ?? header?.id;
    if (writtenId !== id) {
      throw new StudioError(
        422,
        "invalid-scenario",
        writtenId === undefined
          ? `Falta el id del escenario, que tiene que ser igual al nombre de su carpeta ("${id}").`
          : `El id del escenario ("${writtenId}") tiene que ser igual al nombre de su carpeta ("${id}").`,
      );
    }

    await writeFileAtomic(fs, current.path, yaml);
    // The generator needs a valid scenario: a draft that fails the schema keeps the generated
    // files as they were, and the response says so.
    if (scenario === undefined) {
      return { hash: sha256(yaml), regenerated: [], generatedSkipped: true };
    }
    const regenerated = await writeGenerated(id, scenario, shared);
    return { hash: sha256(yaml), regenerated, generatedSkipped: false };
  };

  const saveScenario: ContentStore["saveScenario"] = (id, yaml, baseHash) =>
    enqueue(() => save(id, yaml, baseHash));

  /** The text the new scenario starts from; nothing is written yet. */
  const sourceText = async (request: CreateRequest): Promise<string> => {
    switch (request.source) {
      case "empty":
        return EMPTY_SCENARIO;
      case "template":
        return fs.readFile(await paths.template(request.from), "utf8");
      case "duplicate":
        // Only read: duplicating never changes the original.
        return (await readExisting(request.from)).bytes.toString("utf8");
    }
  };

  const create = async (request: CreateRequest): Promise<CreateResponse> => {
    const { id, title } = request;
    const source = await sourceText(request);
    const author = await readGitHubUser((file) => fs.readFile(file, "utf8"), gitConfigFiles);
    let yaml: string;
    try {
      yaml = newScenarioText(source, { id, title, author });
    } catch (error) {
      if (!(error instanceof EditError)) throw error;
      throw new StudioError(
        422,
        "invalid-scenario",
        `No se creó: el escenario de origen no se puede leer (${error.message}). Corregilo antes de duplicarlo.`,
      );
    }
    const shared = await readShared();
    // S10 for a new scenario: the request carries no YAML, the text is the server's own. It has
    // to parse and carry the new id, but it may not pass the schema yet (an empty scenario, or no
    // author), so the generated files are written only when it does; saving regenerates them.
    const validation = validateScenarioText(yaml, id, shared);
    if (validation.findings.some((finding) => finding.code === "YAML")) {
      throw new StudioError(
        422,
        "invalid-scenario",
        "No se creó: el YAML resultante no es válido.",
      );
    }

    const dir = await paths.createDir(id);
    try {
      await writeFileAtomic(fs, (await paths.file(id, "scenario.yaml")).path, yaml);
    } catch (error) {
      await paths.removeEmptyDir(dir);
      throw error;
    }
    const generated =
      validation.scenario === undefined
        ? []
        : await writeGenerated(id, validation.scenario, shared);
    return { id, author: author ?? null, generated };
  };

  const createScenario: ContentStore["createScenario"] = (request) =>
    enqueue(() => create(request));

  return { listScenarios, readScenario, saveScenario, createScenario, readShared };
};
