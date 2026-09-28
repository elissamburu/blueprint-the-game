// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type {
  Area,
  Badge,
  Category,
  ConfusionGroup,
  GameRules,
  Scenario,
  Service,
} from "@blueprint/scenario-schema";

export type Severity = "error" | "warning";

/**
 * Path inside the scenario document (or the file path, for L012). For shared content (C0xx)
 * the first segment is the key of the file in SharedContentInput (`catalog`, `badges`, …).
 */
export type IssuePath = (string | number)[];

export interface Issue {
  /** Rule code from docs/03 §3, e.g. `L005` or `C001`. */
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
  areas: readonly Area[];
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

/** Shared files every scenario depends on, already parsed (docs/03 §4–§6). */
export interface SharedContentInput {
  /** content/catalog/services.yaml */
  catalog: readonly Service[];
  /** content/catalog/categories.yaml */
  categories: readonly Category[];
  /** content/catalog/confusion-groups.yaml */
  confusionGroups: readonly ConfusionGroup[];
  /** content/areas.yaml */
  areas: readonly Area[];
  /** content/game-rules.yaml */
  gameRules: GameRules;
  /** content/badges/badges.yaml */
  badges: readonly Badge[];
}

/** Key of a shared file: the first segment of the path of a C0xx issue. */
export type SharedContentKey = keyof SharedContentInput;

export interface SharedRule {
  code: string;
  /** One-line summary, in Spanish, for reporters and the Studio. */
  description: string;
  check: (input: SharedContentInput) => Issue[];
}
