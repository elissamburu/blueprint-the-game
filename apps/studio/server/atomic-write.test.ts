// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S7: atomic writes, directly and through PUT /api/scenarios/:id.
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TMP_SUFFIX, writeFileAtomic } from "./atomic-write.js";
import { sha256 } from "./content-store.js";
import { nodeFs, type ContentFs } from "./fs.js";
import {
  createWorkspace,
  recordingFs,
  silentLog,
  testApp,
  writeHeaders,
  type Workspace,
} from "./testing/workspace.js";

const ID = "static-website-https";
let workspace: Workspace;
let dir: string;
let file: string;

beforeEach(async () => {
  workspace = await createWorkspace();
  dir = path.join(workspace.root, "atomic");
  await (await import("node:fs/promises")).mkdir(dir);
  file = path.join(dir, "scenario.yaml");
  await writeFile(file, "original\n", "utf8");
});
afterEach(async () => {
  await workspace.dispose();
});

const errno = (code: string) => Object.assign(new Error(code), { code });

describe("S7: atomic write", () => {
  it("S7: replaces the file and leaves no temporary files", async () => {
    await writeFileAtomic(nodeFs, file, "nuevo\n");
    expect(await readFile(file, "utf8")).toBe("nuevo\n");
    expect(await readdir(dir)).toEqual(["scenario.yaml"]);
  });

  it("S7: if the write fails before rename, the original stays intact and no temporary is left", async () => {
    const failingOpen: ContentFs["open"] = async (target, flags) => {
      const handle = await nodeFs.open(target, flags);
      // A disk full in the middle of the write: the temporary file already exists.
      handle.writeFile = () => Promise.reject(errno("ENOSPC"));
      return handle;
    };
    const fs: ContentFs = { ...nodeFs, open: failingOpen };
    await expect(writeFileAtomic(fs, file, "nuevo\n")).rejects.toThrow("ENOSPC");
    expect(await readFile(file, "utf8")).toBe("original\n");
    expect(await readdir(dir)).toEqual(["scenario.yaml"]);
  });

  it("S7: if rename fails, the original stays intact and no temporary is left", async () => {
    const fs: ContentFs = { ...nodeFs, rename: () => Promise.reject(errno("EXDEV")) };
    await expect(writeFileAtomic(fs, file, "nuevo\n")).rejects.toThrow("EXDEV");
    expect(await readFile(file, "utf8")).toBe("original\n");
    expect(await readdir(dir)).toEqual(["scenario.yaml"]);
  });

  it("S7: retries a rename that fails with EPERM or EBUSY (Windows)", async () => {
    const failures = ["EPERM", "EBUSY"];
    const fs: ContentFs = {
      ...nodeFs,
      rename: (from, to) => {
        const code = failures.shift();
        return code === undefined ? nodeFs.rename(from, to) : Promise.reject(errno(code));
      },
    };
    await writeFileAtomic(fs, file, "nuevo\n", { delayMs: 1 });
    expect(await readFile(file, "utf8")).toBe("nuevo\n");
    expect(await readdir(dir)).toEqual(["scenario.yaml"]);
  });

  it("S7: gives up after the last attempt and cleans up", async () => {
    const fs: ContentFs = { ...nodeFs, rename: () => Promise.reject(errno("EBUSY")) };
    await expect(writeFileAtomic(fs, file, "nuevo\n", { attempts: 3, delayMs: 1 })).rejects.toThrow(
      "EBUSY",
    );
    expect(await readFile(file, "utf8")).toBe("original\n");
    expect(await readdir(dir)).toEqual(["scenario.yaml"]);
  });

  it(`S7: the temporary file sits next to the target and ends with ${TMP_SUFFIX}`, async () => {
    const { fs, calls } = recordingFs();
    await writeFileAtomic(fs, file, "nuevo\n");
    const opened = calls.find((call) => call.method === "open");
    expect(path.dirname(opened?.target ?? "")).toBe(dir);
    expect(opened?.target.endsWith(TMP_SUFFIX)).toBe(true);
  });

  it("S7: a save whose rename fails answers 500 and leaves the scenario intact", async () => {
    const before = await workspace.read(ID);
    const yaml = `${before.toString("utf8")}# cambio\n`;
    const log = silentLog();
    const fs: ContentFs = { ...nodeFs, rename: () => Promise.reject(errno("EIO")) };
    const response = await testApp(workspace, { fs, log }).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers: writeHeaders(),
      body: JSON.stringify({ yaml, baseHash: sha256(before) }),
    });
    expect(response.status).toBe(500);
    expect((await workspace.read(ID)).equals(before)).toBe(true);
    expect(await workspace.tmpFiles(ID)).toEqual([]);
    expect(log.lines.join("\n")).toContain("EIO");
  });
});
