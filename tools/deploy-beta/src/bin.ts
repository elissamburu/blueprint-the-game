// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Entry point: `tsx src/bin.ts <command>` (root scripts build:beta, preview:beta and deploy:beta).
import { main } from "./cli.js";

process.exitCode = await main(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});
