// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @ts-check
import { defineConfig } from "vitest/config";

/**
 * Shared Vitest config. Usage in a package's `vitest.config.ts`:
 *   export { default } from "@blueprint/config/vitest";
 * or extend it with `mergeConfig(base, defineConfig({ ... }))`.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
  },
});
