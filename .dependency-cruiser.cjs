// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Package boundaries from docs/04-estructura-monorepo.md §2. Run with `pnpm deps:check`.
// Rules target paths, so they already cover packages that do not exist yet.

/**
 * Packages that must stay pure: data in, data out, no IO (CLAUDE.md). Purity applies to
 * their src/ (tests included); build scripts in scripts/ may use Node.
 */
const PURE_PACKAGES = ["scenario-schema", "content-lint", "catalog", "game-engine"];
const PURE_PATH = `^packages/(${PURE_PACKAGES.join("|")})/src/`;

/**
 * Heavy dependencies only the local Studio uses (ADR-0025 §3): CodeMirror and elkjs. Matches the
 * installed path (node_modules/@codemirror/...) and an unresolved import (@codemirror/...).
 */
const STUDIO_ONLY_DEPS = "(^|/)(@codemirror/|elkjs(/|$))";

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
      name: "web-not-to-studio-only-deps",
      severity: "error",
      comment:
        "ADR-0025 §3: nothing reachable from apps/web/src, through any workspace package, may get to " +
        "@codemirror/* or elkjs: they are Studio-only and would blow up the game bundle (RNF-03). " +
        "The build of apps/web checks the same on the real bundle.",
      from: { path: "^apps/web/src/" },
      to: { path: STUDIO_ONLY_DEPS, reachable: true },
    },
    {
      name: "web-not-to-diagram-editor",
      severity: "error",
      comment:
        "The visual editor of the diagram is for the Studio only (RF-STU-04): it lives in the " +
        "@blueprint/diagram/editor subpath, and nothing reachable from apps/web/src may get to it.",
      from: { path: "^apps/web/src/" },
      to: {
        path: "(^|/)(packages|@blueprint)/diagram/src/(editor[.-]|DiagramEditor|ConnectDialog)",
        reachable: true,
      },
    },
    {
      name: "diagram-entry-not-to-layout",
      severity: "error",
      comment:
        "ADR-0025 §2: the auto-layout (elkjs) lives in the @blueprint/diagram/layout subpath, which " +
        "the Studio loads on demand. Nothing reachable from the main entry of diagram (the board " +
        "the game loads) may get to it or to elkjs, whatever app imports it.",
      from: { path: "^packages/diagram/src/index\\.ts$" },
      to: {
        path: "(^|/)(packages|@blueprint)/diagram/src/layout\\.ts$|(^|/)elkjs(/|$)",
        reachable: true,
      },
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
      name: "studio-server-no-processes",
      severity: "error",
      comment:
        "S11 (ADR-0025): the Studio server runs no processes in F2 (child_process). Also enforced " +
        "by ESLint in apps/studio; creating PRs with gh (F5) revisits it with an ADR of its own.",
      from: { path: "^apps/studio/server/" },
      to: { dependencyTypes: ["core"], path: "^(node:)?child_process$" },
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
      // Workspace packages followed through node_modules are checked at their real path.
      from: { pathNot: "(^|/)node_modules/" },
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
      // Workspace packages followed through node_modules are checked at their real path.
      from: { pathNot: "(^|/)node_modules/" },
      to: { dependencyTypes: ["npm-no-pkg", "npm-unknown"] },
    },
  ],
  options: {
    // Workspace packages (node_modules/@blueprint/*) are followed so `reachable` rules see through
    // them; third-party packages are not.
    doNotFollow: { path: "node_modules/(?!@blueprint/)" },
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
