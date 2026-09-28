// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Human-readable output of the CLI. `--format json` prints the report objects as they are.
import type { Finding } from "./findings.js";
import type { ValidationReport } from "./validate.js";

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

const SEVERITY_LABEL = { error: "error  ", warning: "warning" } as const;

/**
 * One line per finding. The file is shown unless it is the group's file or the message
 * already names it.
 */
export const formatFinding = (finding: Finding, groupFile?: string): string => {
  const showFile = finding.file !== groupFile && !finding.message.includes(finding.file);
  const location = [showFile ? finding.file : undefined, finding.where].filter(
    (part) => part !== undefined,
  );
  const prefix = location.length > 0 ? `${location.join(" › ")}: ` : "";
  return `  ${SEVERITY_LABEL[finding.severity]} ${finding.code.padEnd(6)} ${prefix}${finding.message}`;
};

export const formatSummary = (errors: number, warnings: number): string =>
  `${plural(errors, "error", "errores")}, ${plural(warnings, "warning", "warnings")}`;

export const formatValidationText = (report: ValidationReport): string => {
  const lines: string[] = [];
  if (report.shared.length > 0) {
    lines.push("Archivos compartidos y ejecución");
    for (const finding of report.shared) lines.push(formatFinding(finding));
    lines.push("");
  }
  for (const scenario of report.scenarios) {
    if (scenario.findings.length === 0) {
      lines.push(`✔ ${scenario.id}  (${scenario.file})`);
      continue;
    }
    lines.push(`✖ ${scenario.id}  (${scenario.file})`);
    for (const finding of scenario.findings) lines.push(formatFinding(finding, scenario.file));
    lines.push("");
  }
  if (report.skipped.length > 0) {
    if (lines.at(-1) !== "") lines.push("");
    for (const skip of report.skipped) lines.push(`Omitida ${skip.code}: ${skip.reason}.`);
  }
  if (lines.length > 0 && lines.at(-1) !== "") lines.push("");
  const { scenarios, errors, warnings } = report.summary;
  lines.push(
    `${report.ok ? "OK" : "FALLÓ"}: ${formatSummary(errors, warnings)} en ${plural(scenarios, "escenario", "escenarios")}.`,
  );
  return `${lines.join("\n")}\n`;
};
