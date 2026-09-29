// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import base from "@blueprint/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  mergeConfig(base, viteConfig),
  defineConfig({
    test: {
      include: ["src/**/*.test.{ts,tsx}"],
      environment: "jsdom",
      setupFiles: ["src/testing/setup.ts"],
      // Rendering the whole game screen takes seconds in jsdom (see src/testing/setup.ts).
      testTimeout: 30_000,
    },
  }),
);
