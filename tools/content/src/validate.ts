// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// content:validate (RF-CNT-02): schema of every file, integrity between shared files (C0xx),
// semantic lint of every scenario, plus the rules that need IO: L012 (generated files) and
// L014 (version bump against a base ref).
import path from "node:path";
import {
  checkGeneratedFiles,
  checkVersionBump,
  GENERATED_FILES,
  lintScenario,
  lintSharedContent,
  renderGeneratedFiles,
  sharedRules,
  type SharedContentKey,
} from "@blueprint/content-lint";
import { parseScenario, type Scenario, type Service } from "@blueprint/scenario-schema";
import {
  SCENARIO_FILE,
  SCENARIOS_DIR,
  displayPath,
  isDirectory,
  listScenarioIds,
  loadScenario,
  loadSharedContent,
  parseContentFile,
  readTextIfExists,
  scenarioDir,
  sharedFileDisplay,
  type LoadedScenario,
  type SharedContent,
  type SharedFileKey,
  type SharedRaw,
} from "./content.js";
import { countBySeverity, describePath, fromLintIssue, type Finding } from "./findings.js";
import { GitUnavailableError, assertWorkTree, readFileAtRef, refExists } from "./git.js";

export interface ValidateOptions {
  contentDir: string;
  /** Validate only this scenario (folder name). */
  id?: string;
  /** Git ref to compare versions against (L014), e.g. `origin/main`. */
  base?: string;
}

/** A check that did not run, reported explicitly instead of silently. */
export interface SkippedCheck {
  code: string;
  reason: string;
}

export interface ScenarioReport {
  id: string;
  file: string;
  findings: Finding[];
}

export interface ValidationReport {
  ok: boolean;
  summary: { scenarios: number; errors: number; warnings: number };
  skipped: SkippedCheck[];
  /** Findings of shared files (catalog, game-rules, …) and of the run itself. */
  shared: Finding[];
  /**
   * Integrity between shared files (C0xx), checked once before the scenarios. `null` when it
   * did not run (see `skipped`).
   */
  integrity: Finding[] | null;
  scenarios: ScenarioReport[];
}

export interface InspectedContent {
  report: ValidationReport;
  shared: SharedContent;
  scenarios: LoadedScenario[];
}

const catalogById = (services: readonly Service[]): ReadonlyMap<string, Service> =>
  new Map(services.map((service) => [service.id, service]));

const SHARED_RULE_CODES = `${sharedRules[0]?.code}-${sharedRules.at(-1)?.code}`;

/** File of each lintSharedContent input key (the first segment of a C0xx issue path). */
const SHARED_FILE_OF = new Map<string | number, SharedFileKey>(
  Object.entries({
    catalog: "services",
    categories: "categories",
    confusionGroups: "confusionGroups",
    areas: "areas",
    gameRules: "gameRules",
    badges: "badges",
  } satisfies Record<SharedContentKey, SharedFileKey>),
);

/** C0xx rules; `null` when a shared file is missing or invalid. */
const checkIntegrity = (
  contentDir: string,
  shared: SharedContent,
  raw: SharedRaw,
): Finding[] | null => {
  const { services, categories, confusionGroups, areas, gameRules, badges } = shared;
  if (
    services === undefined ||
    categories === undefined ||
    confusionGroups === undefined ||
    areas === undefined ||
    gameRules === undefined ||
    badges === undefined
  ) {
    return null;
  }
  const issues = lintSharedContent({
    catalog: services,
    categories,
    confusionGroups,
    areas,
    gameRules,
    badges,
  });
  return issues.map((issue) => {
    const key = SHARED_FILE_OF.get(issue.path[0] ?? "");
    const finding: Finding = { code: issue.code, severity: issue.severity, message: issue.message, file: displayPath(contentDir, contentDir) };
    return key === undefined
      ? { ...finding, where: describePath(undefined, issue.path) }
      : {
          ...finding,
          file: sharedFileDisplay(contentDir, key),
          where: describePath(raw[key], issue.path.slice(1)),
        };
  });
};

const checkGenerated = async (
  contentDir: string,
  loaded: LoadedScenario,
  scenario: Scenario,
  catalog: ReadonlyMap<string, Service>,
): Promise<Finding[]> => {
  const expected = renderGeneratedFiles(scenario, catalog);
  const files = await Promise.all(
    GENERATED_FILES.map(async (name) => {
      const file = path.join(loaded.dir, name);
      return {
        path: displayPath(contentDir, file),
        expected: expected[name],
        actual: await readTextIfExists(file),
      };
    }),
  );
  return checkGeneratedFiles(files).map((issue) => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    file: String(issue.path[0]),
  }));
};

const checkBase = async (
  contentDir: string,
  base: string,
  loaded: LoadedScenario,
  scenario: Scenario,
): Promise<Finding[]> => {
  const relative = `${SCENARIOS_DIR}/${loaded.id}/${SCENARIO_FILE}`;
  const text = await readFileAtRef(contentDir, base, relative);
  if (text === undefined) return [];
  const parsed = parseContentFile(text, `${base}:${loaded.file}`, parseScenario);
  if (parsed.data === undefined) {
    return [
      {
        code: "L014",
        severity: "warning",
        message: `El escenario en ${base} no pasa el schema actual (${parsed.findings.length} problema/s): no se pudo comparar version.`,
        file: loaded.file,
        where: "version",
      },
    ];
  }
  return checkVersionBump(parsed.data, scenario).map((issue) =>
    fromLintIssue(loaded.file, loaded.raw, issue),
  );
};

/** Resolves `--base`: the ref to use, or findings / skips explaining why L014 cannot run. */
const resolveBase = async (
  contentDir: string,
  base: string | undefined,
  display: string,
): Promise<{ ref?: string; findings: Finding[]; skipped: SkippedCheck[] }> => {
  if (base === undefined) {
    return {
      findings: [],
      skipped: [
        {
          code: "L014",
          reason:
            "no se pasó --base <ref> (p. ej. --base origin/main), así que no se comparó version contra la rama base",
        },
      ],
    };
  }
  const fail = (message: string) => ({
    findings: [{ code: "GIT", severity: "error" as const, message, file: display }],
    skipped: [{ code: "L014", reason: "no se pudo leer la ref base (ver el error GIT)" }],
  });
  try {
    await assertWorkTree(contentDir);
  } catch (error) {
    if (error instanceof GitUnavailableError) return fail(error.message);
    throw error;
  }
  if (!(await refExists(contentDir, base))) {
    return fail(
      `La ref base "${base}" no existe en el repositorio (¿falta un git fetch?): L014 no se pudo evaluar.`,
    );
  }
  return { ref: base, findings: [], skipped: [] };
};

export const inspectContent = async (options: ValidateOptions): Promise<InspectedContent> => {
  const contentDir = path.resolve(options.contentDir);
  const display = displayPath(contentDir, contentDir);
  const sharedFindings: Finding[] = [];
  let integrity: Finding[] | null = null;
  const skipped: SkippedCheck[] = [];
  const reports: ScenarioReport[] = [];
  const scenarios: LoadedScenario[] = [];
  let shared: SharedContent = {};

  if (!(await isDirectory(contentDir))) {
    sharedFindings.push({
      code: "FILE",
      severity: "error",
      message: `No existe el directorio de contenido ${contentDir}.`,
      file: display,
    });
  } else {
    const loadedShared = await loadSharedContent(contentDir);
    shared = loadedShared.shared;
    sharedFindings.push(...loadedShared.findings);

    integrity = checkIntegrity(contentDir, shared, loadedShared.raw);
    if (integrity === null) {
      skipped.push({
        code: SHARED_RULE_CODES,
        reason:
          "falta algún archivo compartido o tiene errores, así que no se validó la integridad entre ellos",
      });
    }

    let ids = await listScenarioIds(contentDir);
    if (ids === undefined) {
      sharedFindings.push({
        code: "FILE",
        severity: "error",
        message: `Falta la carpeta ${display}/${SCENARIOS_DIR}/: contiene un directorio por escenario con su ${SCENARIO_FILE}.`,
        file: `${display}/${SCENARIOS_DIR}`,
      });
      ids = [];
    }
    if (options.id !== undefined) {
      const wanted = options.id;
      if (!ids.includes(wanted)) {
        sharedFindings.push({
          code: "FILE",
          severity: "error",
          message: `No existe el escenario "${wanted}": se esperaba ${displayPath(contentDir, scenarioDir(contentDir, wanted))}/${SCENARIO_FILE}.`,
          file: `${display}/${SCENARIOS_DIR}`,
        });
      }
      ids = ids.filter((id) => id === wanted);
    }

    const { services, categories, confusionGroups, gameRules, areas } = shared;
    const catalog = services === undefined ? undefined : catalogById(services);
    const canLint =
      services !== undefined &&
      categories !== undefined &&
      confusionGroups !== undefined &&
      gameRules !== undefined &&
      areas !== undefined;
    if (ids.length > 0 && !canLint) {
      skipped.push({
        code: "L001-L022",
        reason:
          "el catálogo, las categorías, los grupos de confusión, game-rules o las áreas faltan o tienen errores, así que el lint semántico de los escenarios no se ejecutó",
      });
    }
    if (ids.length > 0 && catalog === undefined) {
      skipped.push({
        code: "L012",
        reason: "sin un catálogo válido no se pueden generar diagram.mmd y README.md para compararlos",
      });
    }

    const base = await resolveBase(contentDir, options.base, display);
    sharedFindings.push(...base.findings);
    skipped.push(...base.skipped);

    for (const id of ids) {
      const loaded = await loadScenario(contentDir, id);
      const findings = [...loaded.findings];
      const scenario = loaded.scenario;
      if (scenario !== undefined) {
        if (canLint) {
          const issues = lintScenario({
            scenario,
            folderName: id,
            catalog: services,
            categories,
            confusionGroups,
            gameRules,
            areas,
          });
          findings.push(...issues.map((issue) => fromLintIssue(loaded.file, loaded.raw, issue)));
        }
        if (catalog !== undefined) {
          findings.push(...(await checkGenerated(contentDir, loaded, scenario, catalog)));
        }
        if (base.ref !== undefined) {
          findings.push(...(await checkBase(contentDir, base.ref, loaded, scenario)));
        }
      }
      scenarios.push(loaded);
      reports.push({ id, file: loaded.file, findings });
    }
  }

  const counts = countBySeverity([
    ...sharedFindings,
    ...(integrity ?? []),
    ...reports.flatMap((r) => r.findings),
  ]);
  return {
    report: {
      ok: counts.errors === 0,
      summary: { scenarios: reports.length, ...counts },
      skipped,
      shared: sharedFindings,
      integrity,
      scenarios: reports,
    },
    shared,
    scenarios,
  };
};

export const validate = async (options: ValidateOptions): Promise<ValidationReport> =>
  (await inspectContent(options)).report;
