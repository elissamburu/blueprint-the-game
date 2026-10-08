// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import base from "@blueprint/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      // These suites build a site in a temp directory and copy it. On the Windows runner of the
      // CI, with turbo running every package's suite in parallel, that takes seconds: the 5 s
      // default times out now and then.
      testTimeout: 30_000,
    },
  }),
);
