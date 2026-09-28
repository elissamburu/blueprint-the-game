// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Test helpers: a writable copy of fixtures/content in a temporary directory.
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { main, type CliDefaults } from "../cli.js";

export const FIXTURE_CONTENT = fileURLToPath(new URL("../../fixtures/content", import.meta.url));

export interface Workspace {
  /** Temporary root; the content dir is `<root>/content`. */
  root: string;
  contentDir: string;
  outDir: string;
  file: (...segments: string[]) => string;
  read: (...segments: string[]) => Promise<string>;
  write: (segments: string[], text: string) => Promise<void>;
  /** Replaces `search` (must exist) in a content file. */
  edit: (segments: string[], search: string, replacement: string) => Promise<void>;
  remove: (...segments: string[]) => Promise<void>;
  cli: (...argv: string[]) => Promise<{ code: number; stdout: string; stderr: string }>;
  git: (...args: string[]) => string;
  dispose: () => Promise<void>;
}

export const createWorkspace = async (): Promise<Workspace> => {
  const root = await mkdtemp(path.join(os.tmpdir(), "blueprint-content-"));
  const contentDir = path.join(root, "content");
  await cp(FIXTURE_CONTENT, contentDir, { recursive: true });
  const file = (...segments: string[]) => path.join(contentDir, ...segments);
  const read = (...segments: string[]) => readFile(file(...segments), "utf8");
  const defaults: CliDefaults = { contentDir, outDir: path.join(root, "dist"), cwd: root };
  return {
    root,
    contentDir,
    outDir: defaults.outDir,
    file,
    read,
    write: (segments, text) => writeFile(file(...segments), text, "utf8"),
    edit: async (segments, search, replacement) => {
      const text = await read(...segments);
      if (!text.includes(search)) throw new Error(`"${search}" not found in ${segments.join("/")}`);
      await writeFile(file(...segments), text.replace(search, replacement), "utf8");
    },
    remove: (...segments) => rm(file(...segments), { recursive: true, force: true }),
    cli: async (...argv) => {
      let stdout = "";
      let stderr = "";
      const code = await main(
        argv,
        { stdout: (text) => (stdout += text), stderr: (text) => (stderr += text) },
        defaults,
      );
      return { code, stdout, stderr };
    },
    git: (...args) =>
      execFileSync(
        "git",
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@example.com",
          "-c",
          "commit.gpgsign=false",
          "-c",
          "core.autocrlf=false",
          ...args,
        ],
        { cwd: root, encoding: "utf8", windowsHide: true },
      ),
    dispose: () => rm(root, { recursive: true, force: true }),
  };
};
