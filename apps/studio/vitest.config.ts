// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Two suites: the server and the shared validation in Node (temporary copies of content/, never
// the real one), and the UI in jsdom.
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "server",
          include: ["server/**/*.test.ts", "shared/**/*.test.ts"],
          environment: "node",
          // Every test copies content/ to a temporary folder.
          testTimeout: 30_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "ui",
          include: ["src/**/*.test.{ts,tsx}"],
          environment: "jsdom",
          setupFiles: ["src/testing/setup.ts"],
          testTimeout: 30_000,
        },
      },
    ],
  },
});
