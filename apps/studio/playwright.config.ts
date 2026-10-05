// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// End-to-end tests of the Studio, a Playwright project of its own (the game's suite does not
// change). Run them with `pnpm e2e:studio` from the repo root: it builds the UI first. The server
// is the one of `pnpm studio` over a fresh temporary copy of content/ (e2e/serve.ts). The specs
// save files of that copy, so they run one after the other.
import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./e2e/support/studio";

const CI = process.env.CI !== undefined && process.env.CI !== "";

export default defineConfig({
  testDir: "e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://127.0.0.1:${E2E_PORT}`,
    locale: "es-AR",
    trace: "retain-on-failure",
  },
  webServer: {
    // node, not pnpm exec: see apps/web/playwright.config.ts (the kill must reach the server).
    command: "node --import tsx e2e/serve.ts",
    url: `http://127.0.0.1:${E2E_PORT}`,
    // Always a fresh copy of content/.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
