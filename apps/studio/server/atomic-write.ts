// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S7: atomic write. The text goes to a temporary file in the same folder (`*.studio-tmp`, ignored
// by git) and replaces the target with rename, so the target is either the old or the new
// content, never half written. On Windows a rename can fail for a moment with EPERM or EBUSY
// (an antivirus or the indexer holding the file): it is retried. On any error only that
// temporary file is removed.
import { randomBytes } from "node:crypto";
import path from "node:path";
import { errorCode, type ContentFs } from "./fs.js";

export const TMP_SUFFIX = ".studio-tmp";

const RETRYABLE = new Set(["EPERM", "EBUSY", "EACCES"]);

export interface AtomicWriteOptions {
  /** Rename attempts before giving up (default 6). */
  attempts?: number;
  /** Wait before the first retry, doubled on each one (default 25 ms). */
  delayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const writeFileAtomic = async (
  fs: ContentFs,
  file: string,
  text: string,
  { attempts = 6, delayMs = 25 }: AtomicWriteOptions = {},
): Promise<void> => {
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${randomBytes(6).toString("hex")}${TMP_SUFFIX}`,
  );
  try {
    // "wx": never reuse an existing file, not even a leftover temporary one.
    const handle = await fs.open(tmp, "wx");
    try {
      await handle.writeFile(text, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    for (let attempt = 1; ; attempt++) {
      try {
        await fs.rename(tmp, file);
        return;
      } catch (error) {
        const code = errorCode(error);
        if (attempt >= attempts || code === undefined || !RETRYABLE.has(code)) throw error;
        await sleep(delayMs * 2 ** (attempt - 1));
      }
    }
  } catch (error) {
    await fs.rm(tmp, { force: true });
    throw error;
  }
};
