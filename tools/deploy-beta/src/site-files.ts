// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readdir } from "node:fs/promises";
import path from "node:path";

/**
 * Every file under `dir` as a bucket key: its relative path with "/" on every system, sorted.
 * A missing directory has no files.
 */
export const listSiteFiles = async (dir: string): Promise<string[]> => {
  let entries;
  try {
    entries = await readdir(dir, { recursive: true, withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"),
    )
    .sort();
};
