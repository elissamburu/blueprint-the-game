// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// End-to-end tests (DoD of F1, docs/accesibilidad.md §7). Run them with `pnpm e2e` from the repo
// root: it builds the content bundles and the web first. Two servers, started from here:
// - `fixture`: the production build (vite preview) over the e2e fixture bundle
//   (e2e/fixtures/content → dist/content-e2e), so the journeys and axe run on fixed content;
// - `content`: the dev server over dist/content-dev, because drafts are only listed in
//   development and every real scenario is checked, drafts included.
import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI !== undefined && process.env.CI !== "";
const FIXTURE_PORT = 4317;
const CONTENT_PORT = 4318;
const VIEWPORT = { width: 1440, height: 900 };
/**
 * Vite is started with node, not through `pnpm exec`: pnpm runs the command in a process group
 * of its own, which the kill Playwright sends to the group of the server (Linux, macOS) does not
 * reach. The server would outlive the run and Playwright would wait for it forever.
 */
const VITE = "node node_modules/vite/bin/vite.js";

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: true,
  // Room for a busy machine: an axe run over the board takes seconds when every worker is busy.
  timeout: 60_000,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  ...(CI ? { workers: 2 } : {}),
  reporter: CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    locale: "es-AR",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "fixture",
      testMatch: ["mvp/**/*.spec.ts", "a11y/**/*.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORT,
        baseURL: `http://localhost:${FIXTURE_PORT}`,
      },
    },
    {
      name: "content",
      testMatch: ["content/**/*.spec.ts"],
      // The dev server serves the game module by module, so every page load takes seconds.
      timeout: 120_000,
      use: {
        ...devices["Desktop Chrome"],
        viewport: VIEWPORT,
        baseURL: `http://localhost:${CONTENT_PORT}`,
      },
    },
  ],
  webServer: [
    {
      command: `${VITE} preview --port ${FIXTURE_PORT} --strictPort`,
      url: `http://localhost:${FIXTURE_PORT}`,
      env: { BLUEPRINT_CONTENT_DIR: "dist/content-e2e" },
      reuseExistingServer: !CI,
    },
    {
      command: `${VITE} --port ${CONTENT_PORT} --strictPort`,
      url: `http://localhost:${CONTENT_PORT}`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
