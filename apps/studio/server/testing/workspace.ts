// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test helpers: a temporary copy of content/ (the tests never touch the real one), a file system
// that records every call, and the headers of a request coming from the Studio itself.
import { cp, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { createApp } from "../app.js";
import { REPO_ROOT } from "../config.js";
import { nodeFs, type ContentFs } from "../fs.js";
import type { Log } from "../log.js";
import type { ClientFiles } from "../static.js";

export const REAL_CONTENT = path.join(REPO_ROOT, "content");
export const PORT = 4399;
export const TOKEN = "test-token-0123456789abcdefghijklmnopqrstuvw";
export const ORIGIN = `http://127.0.0.1:${PORT}`;

/** Headers of a GET sent by the Studio UI. */
export const studioHeaders = (extra: Record<string, string> = {}): Record<string, string> => ({
  host: `127.0.0.1:${PORT}`,
  "x-studio-token": TOKEN,
  "sec-fetch-site": "same-origin",
  ...extra,
});

/** Headers of a PUT sent by the Studio UI. */
export const writeHeaders = (extra: Record<string, string> = {}): Record<string, string> =>
  studioHeaders({ origin: ORIGIN, "content-type": "application/json", ...extra });

export interface FsCall {
  method: keyof ContentFs;
  target: string;
}

/** node:fs/promises that records the method and first argument of every call. */
export const recordingFs = (
  overrides: Partial<ContentFs> = {},
): { fs: ContentFs; calls: FsCall[] } => {
  const calls: FsCall[] = [];
  const base: ContentFs = { ...nodeFs, ...overrides };
  const fs = Object.fromEntries(
    (Object.keys(base) as (keyof ContentFs)[]).map((method) => [
      method,
      (...args: unknown[]) => {
        calls.push({ method, target: String(args[0]) });
        return (base[method] as (...a: unknown[]) => unknown)(...args);
      },
    ]),
  ) as unknown as ContentFs;
  return { fs, calls };
};

export const silentLog = (): Log & { lines: string[] } => {
  const lines: string[] = [];
  return { lines, info: (m) => lines.push(m), error: (m) => lines.push(m) };
};

export interface Workspace {
  root: string;
  contentDir: string;
  scenarioFile: (id: string, name?: string) => string;
  read: (id: string, name?: string) => Promise<Buffer>;
  /** Files left in a scenario folder whose name ends with .studio-tmp. */
  tmpFiles: (id: string) => Promise<string[]>;
  dispose: () => Promise<void>;
}

export const createWorkspace = async (): Promise<Workspace> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-studio-"));
  const contentDir = path.join(root, "content");
  await cp(REAL_CONTENT, contentDir, { recursive: true });
  const scenarioFile = (id: string, name = "scenario.yaml") =>
    path.join(contentDir, "scenarios", id, name);
  return {
    root,
    contentDir,
    scenarioFile,
    read: (id, name) => readFile(scenarioFile(id, name)),
    tmpFiles: async (id) =>
      (await readdir(path.join(contentDir, "scenarios", id))).filter((f) =>
        f.endsWith(".studio-tmp"),
      ),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
};

/** Ids of the scenarios of the real content/ (folders not starting with `_`). */
export const realScenarioIds = async (): Promise<string[]> =>
  (await readdir(path.join(REAL_CONTENT, "scenarios"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => entry.name)
    .sort();

export const TEST_CLIENT: ClientFiles = {
  indexHtml:
    '<!doctype html>\n<html lang="es">\n  <head>\n    <title>Studio</title>\n  </head>\n  <body><div id="root"></div></body>\n</html>\n',
  assetsDir: path.join(os.tmpdir(), "blueprint-studio-no-assets"),
};

export const testApp = (
  workspace: Workspace,
  options: { fs?: ContentFs; log?: Log; iconsDir?: string } = {},
) =>
  createApp({
    port: PORT,
    token: TOKEN,
    contentDir: workspace.contentDir,
    iconsDir: options.iconsDir ?? path.join(workspace.root, "icons"),
    log: options.log ?? silentLog(),
    client: TEST_CLIENT,
    ...(options.fs === undefined ? {} : { fs: options.fs }),
  });

/** A port that was free a moment ago on 127.0.0.1. */
export const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
