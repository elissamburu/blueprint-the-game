// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// @ts-check
// Writes dist/scenario.schema.json from the compiled Zod schema. Runs after `tsc` in `build`.
// Scripts may use Node; src/ must never import from here (.dependency-cruiser.cjs).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { scenarioJsonSchema } from "../dist/index.js";

const target = fileURLToPath(new URL("../dist/scenario.schema.json", import.meta.url));
writeFileSync(target, `${JSON.stringify(scenarioJsonSchema(), null, 2)}\n`);
console.log(`scenario-schema: wrote ${target}`);
