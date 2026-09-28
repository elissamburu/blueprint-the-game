// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import base from "@blueprint/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

// RNF-15: content-lint keeps ≥ 90 % line coverage; `pnpm test` fails below it.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      coverage: {
        enabled: true,
        provider: "v8",
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts", "src/**/*.d.ts", "src/testing/**"],
        reporter: ["text-summary", "text"],
        thresholds: { lines: 90 },
      },
    },
  }),
);
