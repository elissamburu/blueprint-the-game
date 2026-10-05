// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The file system operations the server uses, as a port: production passes node:fs/promises, and
// the tests wrap it to count calls (S5) or to make one fail (S7).
import * as fsp from "node:fs/promises";

export type ContentFs = Pick<
  typeof fsp,
  | "lstat"
  | "mkdir"
  | "open"
  | "readFile"
  | "readdir"
  | "realpath"
  | "rename"
  | "rm"
  | "rmdir"
  | "stat"
>;

export const nodeFs: ContentFs = fsp;

export const errorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export const isNotFound = (error: unknown): boolean => {
  const code = errorCode(error);
  return code === "ENOENT" || code === "ENOTDIR";
};
