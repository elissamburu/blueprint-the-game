// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import base from "@blueprint/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["src/testing/setup.ts"],
      // Components with Radix popovers and user-event take seconds in jsdom when turbo runs every
      // package's suite in parallel: the 5 s default times out now and then.
      testTimeout: 30_000,
    },
  }),
);
