// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Entry point of `pnpm studio` (run with tsx).
import { run } from "./cli.js";

const server = await run();
if (server === undefined) {
  process.exitCode = 1;
} else {
  const stop = () => void server.close().finally(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
