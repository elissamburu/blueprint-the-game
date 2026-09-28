// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Entry point: `tsx src/bin.ts <validate|gen|build> [options]` (root scripts content:*).
import { main } from "./cli.js";

process.exitCode = await main(process.argv.slice(2));
