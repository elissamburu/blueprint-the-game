// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Server of the e2e suite: a fresh copy of content/ in a temporary folder, and the Studio as
// `pnpm studio` runs it (built UI, same rules) over that copy.
import { cp, rm } from "node:fs/promises";
import path from "node:path";
import { run } from "../server/cli.js";
import { E2E_CONTENT, E2E_PORT, E2E_ROOT, REPO_ROOT } from "./support/studio.js";

await rm(E2E_ROOT, { recursive: true, force: true });
await cp(path.join(REPO_ROOT, "content"), E2E_CONTENT, { recursive: true });

const server = await run({
  env: { ...process.env, STUDIO_PORT: String(E2E_PORT), STUDIO_CONTENT_DIR: E2E_CONTENT },
});
if (server === undefined) process.exit(1);
