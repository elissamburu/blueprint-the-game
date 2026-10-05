// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @ts-check
import base from "@blueprint/config/eslint-react";
import { defineConfig } from "eslint/config";

const CHILD_PROCESS = ["child_process", "node:child_process"];
const S11 = "S11 (ADR-0025): el servidor del Studio no ejecuta procesos en F2.";

export default defineConfig(base, {
  // S11 (ADR-0025 §4): the Studio server runs no processes in F2. Creating the PR with gh
  // (RF-STU-15, F5) revisits this rule with an ADR of its own.
  files: ["server/**/*.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      { paths: CHILD_PROCESS.map((name) => ({ name, message: S11 })) },
    ],
    "no-restricted-syntax": [
      "error",
      ...CHILD_PROCESS.map((name) => ({
        selector: `ImportExpression[source.value='${name}']`,
        message: S11,
      })),
      {
        selector: "CallExpression[callee.object.name='process'][callee.property.name='binding']",
        message: S11,
      },
    ],
  },
});
