// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @ts-check
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import base from "./eslint.js";

/**
 * Shared flat config for React packages (browser code). Usage in `eslint.config.js`:
 *   export { default } from "@blueprint/config/eslint-react";
 */
export default defineConfig(base, reactHooks.configs.flat["recommended-latest"], {
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: { globals: globals.browser },
});
