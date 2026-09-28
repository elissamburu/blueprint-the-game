// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Minimal git access for L014. git runs through execFile (no shell), so refs and paths are
// passed as plain arguments on every OS.
import { execFile } from "node:child_process";

/** git is missing or `cwd` is not inside a work tree: L014 cannot run at all. */
export class GitUnavailableError extends Error {}

interface GitRun {
  ok: boolean;
  stdout: string;
}

const git = (cwd: string, args: readonly string[]): Promise<GitRun> =>
  new Promise((resolve, reject) => {
    execFile(
      "git",
      args,
      { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true },
      (error, stdout) => {
        if (error === null) {
          resolve({ ok: true, stdout });
        } else if (typeof error.code === "number") {
          resolve({ ok: false, stdout });
        } else {
          reject(
            new GitUnavailableError(
              `No se pudo ejecutar git (${error.message}). L014 necesita git instalado y en el PATH.`,
            ),
          );
        }
      },
    );
  });

export const assertWorkTree = async (cwd: string): Promise<void> => {
  const result = await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  if (!result.ok || result.stdout.trim() !== "true") {
    throw new GitUnavailableError(
      "El directorio de contenido no está dentro de un repositorio git: L014 no puede leer la versión base.",
    );
  }
};

/** True when `ref` names a commit. Refs starting with `-` are rejected (never options). */
export const refExists = async (cwd: string, ref: string): Promise<boolean> => {
  if (ref === "" || ref.startsWith("-")) return false;
  const result = await git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
  return result.ok;
};

/**
 * Content of `relativePath` (relative to `cwd`, with `/`) at `ref`, or `undefined` when the
 * file does not exist there. Call `refExists` first.
 */
export const readFileAtRef = async (
  cwd: string,
  ref: string,
  relativePath: string,
): Promise<string | undefined> => {
  const spec = `${ref}:./${relativePath}`;
  const exists = await git(cwd, ["cat-file", "-e", spec]);
  if (!exists.ok) return undefined;
  const result = await git(cwd, ["show", spec]);
  return result.ok ? result.stdout : undefined;
};
