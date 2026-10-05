// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the API does with content/: list and read scenarios, save one (S7, S8, S10) regenerating
// diagram.mmd and README.md, and read the shared files. Every path goes through ScenarioPaths (S5).
// There is no operation to delete or rename (S8); creating arrives with RF-STU-01.
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
} from "@blueprint/scenario-schema";
import { parse } from "yaml";
import {
  ScenarioIdSchema,
  type SaveResponse,
  type ScenarioFile,
  type ScenarioSummary,
  type SharedContent,
} from "../shared/api.js";
import { validateScenarioText } from "../shared/validation.js";
import { writeFileAtomic } from "./atomic-write.js";
import { StudioError } from "./errors.js";
import { isNotFound, type ContentFs } from "./fs.js";
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
  readShared: () => Promise<SharedContent>;
}

export const createContentStore = ({
  fs,
  contentDir,
}: {
  fs: ContentFs;
  contentDir: string;
}): ContentStore => {
  const paths = createScenarioPaths(fs, contentDir);
  /** Saves run one after the other, so the hash check and the write of one are never interleaved. */
  let queue: Promise<unknown> = Promise.resolve();

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
    return { id, yaml: bytes.toString("utf8"), hash: sha256(bytes) };
  };

  const save = async (
    id: string,
    yaml: string,
    baseHash: string | undefined,
  ): Promise<SaveResponse> => {
    const current = await readExisting(id);
    // S8: never overwrite blindly. Without the hash of what the author opened, or with an old
    // one, the file is left as it is.
    if (baseHash === undefined || baseHash !== sha256(current.bytes)) {
      throw new StudioError(
        409,
        "conflict",
        "El archivo cambió en disco desde que lo abriste: no se guardó para no pisar esos cambios.",
      );
    }
    const shared = await readShared();
    // S10: revalidate YAML, schema and id before writing anything. Lint findings do not block
    // saving: a draft can be saved while it is being fixed.
    const validation = validateScenarioText(yaml, id, shared);
    const first = validation.findings[0];
    if (validation.scenario === undefined) {
      const where = first !== undefined && first.where !== "" ? ` (${first.where})` : "";
      throw new StudioError(
        422,
        "invalid-scenario",
        `No se guardó: ${first?.message ?? "el escenario no es válido"}${where}.`,
        first?.line,
      );
    }
    if (validation.scenario.id !== id) {
      throw new StudioError(
        422,
        "invalid-scenario",
        `No se guardó: el id del escenario ("${validation.scenario.id}") tiene que ser igual al nombre de su carpeta ("${id}").`,
      );
    }

    await writeFileAtomic(fs, current.path, yaml);

    const catalog = new Map(shared.catalog.map((service) => [service.id, service]));
    const generated = renderGeneratedFiles(validation.scenario, catalog);
    const regenerated: GeneratedFileName[] = [];
    for (const name of GENERATED_FILES) {
      const file = await paths.file(id, name);
      const actual = file.exists ? await fs.readFile(file.path, "utf8") : undefined;
      // Like pnpm content:gen: an up-to-date file is not rewritten, so its bytes do not change.
      if (actual !== undefined && sameText(actual, generated[name])) continue;
      await writeFileAtomic(fs, file.path, generated[name]);
      regenerated.push(name);
    }
    return { hash: sha256(yaml), regenerated };
  };

  const saveScenario: ContentStore["saveScenario"] = (id, yaml, baseHash) => {
    const run = queue.then(() => save(id, yaml, baseHash));
    queue = run.catch(() => undefined);
    return run;
  };

  return { listScenarios, readScenario, saveScenario, readShared };
};
