// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Output of the server. S12: the token is never passed to it.
export interface Log {
  info: (message: string) => void;
  error: (message: string) => void;
}

export const consoleLog = (
  stdout: (text: string) => void = (text) => process.stdout.write(text),
  stderr: (text: string) => void = (text) => process.stderr.write(text),
): Log => ({
  info: (message) => stdout(`${message}\n`),
  error: (message) => stderr(`${message}\n`),
});
