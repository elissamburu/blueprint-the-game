// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// content:build (RF-CNT-04, ADR-0006): the JSON bundle the game consumes, in dist/content/.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BUNDLE_SCHEMA_VERSION,
  type BundleIndex,
  type BundleIndexEntry,
  type Scenario,
} from "@blueprint/scenario-schema";
import { inspectContent, type ValidationReport } from "./validate.js";

export interface BuildOptions {
  contentDir: string;
  outDir: string;
  /** Also bundle and list draft scenarios. Local development only: the deploy never uses it. */
  includeDrafts?: boolean;
}

export interface BuildResult {
  ok: boolean;
  report: ValidationReport;
  outDir: string;
  /** Files written, relative to `outDir`, sorted. */
  files: string[];
  /** Scenarios listed in index.json (beta and published, plus drafts with `includeDrafts`). */
  listed: number;
  /** Draft scenarios left out of the bundle (0 with `includeDrafts`). */
  excludedDrafts: number;
}

export { BUNDLE_SCHEMA_VERSION, type BundleIndex };

type Status = Scenario["status"];

/**
 * Statuses written to the bundle. Retired scenarios keep their JSON so players' history can
 * still open them; drafts only with `includeDrafts`.
 */
const bundledStatuses = (includeDrafts: boolean): ReadonlySet<Status> =>
  new Set<Status>(includeDrafts ? ["draft", "beta", "published", "retired"] : ["beta", "published", "retired"]);

/** Statuses shown in the game's listing (index.json); retired scenarios are never listed. */
const listedStatuses = (includeDrafts: boolean): ReadonlySet<Status> =>
  new Set<Status>(includeDrafts ? ["draft", "beta", "published"] : ["beta", "published"]);

export const scenarioBundleFile = (scenario: Pick<Scenario, "id" | "version">): string =>
  `${scenario.id}.v${scenario.version}.json`;

const indexEntry = (scenario: Scenario): BundleIndexEntry => ({
  id: scenario.id,
  version: scenario.version,
  status: scenario.status,
  level: scenario.level,
  areas: scenario.areas,
  title: scenario.title,
  summary: scenario.summary,
  estimatedMinutes: scenario.estimatedMinutes,
  file: scenarioBundleFile(scenario),
});

const json = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

/** Files this command owns in `outDir`; only these are removed before writing. */
const isBundleFile = (name: string): boolean =>
  ["index.json", "catalog.json", "badges.json", "game-rules.json"].includes(name) ||
  /\.v\d+\.json$/.test(name);

const removeStaleBundle = async (outDir: string): Promise<void> => {
  let names: string[];
  try {
    names = await readdir(outDir);
  } catch {
    return;
  }
  await Promise.all(
    names.filter(isBundleFile).map((name) => rm(path.join(outDir, name), { force: true })),
  );
};

export const build = async (options: BuildOptions): Promise<BuildResult> => {
  const outDir = path.resolve(options.outDir);
  const { report, shared, scenarios } = await inspectContent({ contentDir: options.contentDir });
  const result: BuildResult = {
    ok: false,
    report,
    outDir,
    files: [],
    listed: 0,
    excludedDrafts: 0,
  };
  const { services, categories, confusionGroups, areas, gameRules, badges } = shared;
  if (
    !report.ok ||
    services === undefined ||
    categories === undefined ||
    confusionGroups === undefined ||
    areas === undefined ||
    gameRules === undefined ||
    badges === undefined
  ) {
    return result;
  }
  const includeDrafts = options.includeDrafts === true;
  const bundled = bundledStatuses(includeDrafts);
  const valid = scenarios.flatMap((loaded) =>
    loaded.scenario === undefined ? [] : [loaded.scenario],
  );
  const parsed = valid.filter((scenario) => bundled.has(scenario.status));
  const listing = listedStatuses(includeDrafts);
  const listed = parsed.filter((scenario) => listing.has(scenario.status));
  const index: BundleIndex = {
    schemaVersion: BUNDLE_SCHEMA_VERSION,
    areas,
    scenarios: listed.map(indexEntry),
  };

  const files = new Map<string, unknown>([
    ["index.json", index],
    ["catalog.json", { services, categories, confusionGroups }],
    ["badges.json", badges],
    ["game-rules.json", gameRules],
  ]);
  for (const scenario of parsed) files.set(scenarioBundleFile(scenario), scenario);

  await mkdir(outDir, { recursive: true });
  await removeStaleBundle(outDir);
  for (const [name, value] of files) await writeFile(path.join(outDir, name), json(value), "utf8");

  result.ok = true;
  result.files = [...files.keys()].sort();
  result.listed = listed.length;
  result.excludedDrafts = valid.length - parsed.length;
  return result;
};
