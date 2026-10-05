// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Package boundaries from docs/04-estructura-monorepo.md §2. Run with `pnpm deps:check`.
// Rules target paths, so they already cover packages that do not exist yet.

/**
 * Packages that must stay pure: data in, data out, no IO (CLAUDE.md). Purity applies to
 * their src/ (tests included); build scripts in scripts/ may use Node.
 */
const PURE_PACKAGES = ["scenario-schema", "content-lint", "catalog", "game-engine"];
const PURE_PATH = `^packages/(${PURE_PACKAGES.join("|")})/src/`;

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "packages-not-to-apps-services-tools",
      severity: "error",
      comment: "packages/* are libraries: they must not import from apps/*, services/* or tools/*.",
      from: { path: "^packages/" },
      to: { path: "^(apps|services|tools)/" },
    },
    {
      name: "ui-not-to-game-logic",
      severity: "error",
      comment:
        "packages/ui is presentation only (ADR-0021): components receive state through props and " +
        "must not import game-engine.",
      from: { path: "^packages/ui/" },
      // Matches the workspace link (node_modules/@blueprint/game-engine) and a direct path.
      to: { path: "(^|/)(@blueprint/game-engine|packages/game-engine)(/|$)" },
    },
    {
      name: "diagram-not-to-game-logic",
      severity: "error",
      comment:
        "packages/diagram draws the board: slot states come in by props and it only emits events " +
        "(ADR-0008). It must not import game-engine; packages/play translates its events into commands.",
      from: { path: "^packages/diagram/" },
      to: { path: "(^|/)(@blueprint/game-engine|packages/game-engine)(/|$)" },
    },
    {
      name: "ui-and-diagram-not-to-play",
      severity: "error",
      comment:
        "packages/play is the game screen and the only UI package that may import game-engine " +
        "(ADR-0025): ui and diagram sit below it and must not import it.",
      from: { path: "^packages/(ui|diagram)/" },
      to: { path: "(^|/)(@blueprint/play|packages/play)(/|$)" },
    },
    {
      name: "pure-packages-no-node-builtins",
      severity: "error",
      comment:
        "Pure packages (scenario-schema, content-lint, catalog, game-engine) have no IO: " +
        "Node built-in modules (fs, path, http, child_process, ...) are forbidden, with or without the node: prefix.",
      from: { path: PURE_PATH },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "pure-packages-no-sdks",
      severity: "error",
      comment:
        "Pure packages (scenario-schema, content-lint, catalog, game-engine) must not use AWS or AI SDKs " +
        "(@aws-sdk/*, @anthropic-ai/*).",
      from: { path: PURE_PATH },
      // Matches both installed (node_modules/@aws-sdk/...) and unresolved (@aws-sdk/...) imports.
      to: { path: "(^|/)(@aws-sdk|@anthropic-ai)/" },
    },
    {
      name: "src-not-to-scripts",
      severity: "error",
      comment:
        "Library code must not import the package's own build scripts (packages/<name>/scripts/), " +
        "which may use Node and IO.",
      from: { path: "^packages/([^/]+)/src/" },
      to: { path: "^packages/$1/scripts/" },
    },
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies are forbidden.",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-relative-cross-package",
      severity: "error",
      comment:
        "Import workspace packages by their @blueprint/* name, never by relative path (../../packages/...).",
      from: { path: "^(apps|services|packages|tools)/([^/]+)/" },
      to: {
        dependencyTypes: ["local"],
        path: "^(apps|services|packages|tools)/",
        pathNot: "^$1/$2/",
      },
    },
    {
      name: "no-undeclared-deps",
      severity: "error",
      comment: "Every imported package must be declared in the importing package's package.json.",
      from: {},
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|\\.turbo|test-results|playwright-report)/" },
    // Keep pnpm workspace links as node_modules/@blueprint/* paths so they are typed as
    // npm dependencies (declared or not) instead of local files.
    preserveSymlinks: true,
    tsPreCompilationDeps: true,
    // Each file is checked against its nearest package.json, not the root one.
    combinedDependencies: false,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
    },
  },
};
