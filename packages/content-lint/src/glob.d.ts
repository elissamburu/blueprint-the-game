// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Vite's `import.meta.glob` (used by tests to load every scenario of content/ without fs). The
// package has no vite/client types; only the eager, `?raw` form the tests use.
interface ImportMeta {
  glob(
    pattern: string,
    options: { query: "?raw"; import: "default"; eager: true },
  ): Record<string, string>;
}
