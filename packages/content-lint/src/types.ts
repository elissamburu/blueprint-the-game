// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ConfusionGroup, GameRules, Scenario, Service } from "@blueprint/scenario-schema";

export type Severity = "error" | "warning";

/** Path inside the scenario document (or the file path, for L012). */
export type IssuePath = (string | number)[];

export interface Issue {
  /** Rule code from docs/03 §3, e.g. `L005`. */
  code: string;
  severity: Severity;
  /** Spanish, readable by content authors. */
  message: string;
  path: IssuePath;
}

/** Everything a rule may look at: already parsed and typed by @blueprint/scenario-schema. */
export interface LintInput {
  scenario: Scenario;
  /** Name of the folder that contains `scenario.yaml` (content/scenarios/<folder>/). */
  folderName: string;
  catalog: readonly Service[];
  confusionGroups: readonly ConfusionGroup[];
  gameRules: GameRules;
}

export interface LintContext extends LintInput {
  servicesById: ReadonlyMap<string, Service>;
}

export interface Rule {
  code: string;
  /** One-line summary, in Spanish, for reporters and the Studio. */
  description: string;
  check: (context: LintContext) => Issue[];
}
