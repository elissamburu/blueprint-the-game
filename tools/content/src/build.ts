// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// content:build (RF-CNT-04, ADR-0006): the JSON bundle the game consumes, in dist/content/.
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Area, Scenario } from "@blueprint/scenario-schema";
import { inspectContent, type ValidationReport } from "./validate.js";

export interface BuildOptions {
  contentDir: string;
  outDir: string;
}

export interface BuildResult {
  ok: boolean;
  report: ValidationReport;
  outDir: string;
  /** Files written, relative to `outDir`, sorted. */
  files: string[];
  /** Scenarios listed in index.json (beta and published). */
  listed: number;
}

export const BUNDLE_SCHEMA_VERSION = 1;

/** Statuses shown in the game's listing; drafts and retired scenarios are not listed. */
const LISTED_STATUSES: ReadonlySet<Scenario["status"]> = new Set(["beta", "published"]);

export const scenarioBundleFile = (scenario: Pick<Scenario, "id" | "version">): string =>
  `${scenario.id}.v${scenario.version}.json`;

export interface IndexEntry {
  id: string;
  version: number;
  status: Scenario["status"];
  level: Scenario["level"];
  areas: string[];
  title: string;
  summary: string;
  estimatedMinutes: number;
  file: string;
}

export interface BundleIndex {
  schemaVersion: number;
  areas: Area[];
  scenarios: IndexEntry[];
}

const indexEntry = (scenario: Scenario): IndexEntry => ({
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
  const result: BuildResult = { ok: false, report, outDir, files: [], listed: 0 };
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
  const parsed = scenarios.flatMap((loaded) =>
    loaded.scenario === undefined ? [] : [loaded.scenario],
  );
  const listed = parsed.filter((scenario) => LISTED_STATUSES.has(scenario.status));
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
  return result;
};
