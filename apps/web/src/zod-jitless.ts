// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "zod" for the game's bundle (alias in vite.config.ts): Zod itself, with its JIT turned off.
// Zod compiles the parser of each object schema with `new Function` whenever eval works, and
// probes for it with `Function("")` when the schema is built. The Content-Security-Policy of the
// site has no 'unsafe-eval' (ADR-0028), so the game uses the regular parser. It has to be set
// before any schema is built: every module of the bundle that imports "zod" gets this one, so
// this runs before them (a z.config in main.tsx would run after the schemas of the shared chunks).
import * as z from "zod/v4";

z.config({ jitless: true });

export * from "zod/v4";
export { z, z as default };
