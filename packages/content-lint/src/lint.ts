// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { rules as defaultRules } from "./rules/index.js";
import type { Issue, LintContext, LintInput, Rule } from "./types.js";

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

export const hasErrors = (issues: readonly Issue[]): boolean =>
  issues.some((issue) => issue.severity === "error");
