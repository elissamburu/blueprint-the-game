// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { rules as defaultRules } from "./rules/index.js";
import { sharedRules as defaultSharedRules } from "./shared-rules/index.js";
import type {
  Issue,
  LintContext,
  LintInput,
  Rule,
  SharedContentInput,
  SharedRule,
} from "./types.js";

export const createContext = (input: LintInput): LintContext => ({
  ...input,
  servicesById: new Map(input.catalog.map((service) => [service.id, service])),
});

/**
 * Runs the semantic rules of docs/03 §3 on an already parsed scenario. Pure: no IO.
 * Issues come grouped by rule, in rule order.
 */
export const lintScenario = (input: LintInput, rules: readonly Rule[] = defaultRules): Issue[] => {
  const context = createContext(input);
  return rules.flatMap((rule) => rule.check(context));
};

/**
 * Runs the integrity rules between shared files (C0xx, docs/03 §3) once, independently of the
 * scenarios. Pure: no IO. The first segment of each issue path is the key of the file in
 * `input` (`catalog`, `categories`, …).
 */
export const lintSharedContent = (
  input: SharedContentInput,
  rules: readonly SharedRule[] = defaultSharedRules,
): Issue[] => rules.flatMap((rule) => rule.check(input));

export const hasErrors = (issues: readonly Issue[]): boolean =>
  issues.some((issue) => issue.severity === "error");
