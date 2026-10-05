// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S11: the ESLint config of the Studio forbids running processes from server/. The probe is linted
// in memory with the path of a server file, so nothing is written to the repo.
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const STUDIO_DIR = fileURLToPath(new URL("..", import.meta.url));
const SERVER_FILE = fileURLToPath(new URL("./app.ts", import.meta.url));

const lint = async (code: string, filePath = SERVER_FILE) => {
  const eslint = new ESLint({ cwd: STUDIO_DIR });
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) =>
    ["no-restricted-imports", "no-restricted-syntax"].includes(m.ruleId ?? ""),
  );
};

describe("S11: no processes in the server", () => {
  it.each([
    'import { execFile } from "node:child_process";\nexecFile("gh");\n',
    'import { spawn } from "child_process";\nspawn("git");\n',
    'import * as cp from "node:child_process";\ncp.fork("x");\n',
    'export const run = async () => (await import("node:child_process")).exec("ls");\n',
    'export { exec } from "node:child_process";\n',
  ])("S11: pnpm lint fails on a server file that runs processes (%#)", async (code) => {
    const messages = await lint(code);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages.every((m) => m.severity === 2 && m.message.includes("S11"))).toBe(true);
  });

  it("S11: the rule does not apply outside server/", async () => {
    const configFile = fileURLToPath(new URL("../vitest.config.ts", import.meta.url));
    expect(
      await lint('import { execSync } from "node:child_process";\nexecSync("x");\n', configFile),
    ).toEqual([]);
  });
});
