// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import * as z from "zod";
import { ScenarioSchema } from "./scenario.js";

/**
 * JSON Schema of scenario.yaml for editor autocompletion (yaml-language-server).
 * Uses the input shape, so fields with defaults are optional as authors write them.
 */
export const scenarioJsonSchema = (): Record<string, unknown> =>
  z.toJSONSchema(ScenarioSchema, { io: "input", target: "draft-2020-12" });
