// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Programmatic API of the content CLI (for the Studio and tests).
export type { Finding } from "./findings.js";
export {
  inspectContent,
  validate,
  type ScenarioReport,
  type SkippedCheck,
  type ValidateOptions,
  type ValidationReport,
} from "./validate.js";
export { generate, type GenOptions, type GenResult } from "./gen.js";
export { GENERATED_FILES, renderDiagram, renderGeneratedFiles, renderReadme } from "./generate.js";
export { build, type BuildOptions, type BuildResult, type BundleIndex } from "./build.js";
export { formatValidationText } from "./report.js";
export { main } from "./cli.js";
