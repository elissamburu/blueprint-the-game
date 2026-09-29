// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RNF-03: the initial JS (the entry chunk plus its static imports, not the lazy route chunks)
// must stay under 250 KB gzip. Run after `vite build`: pnpm --filter @blueprint/web size
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const LIMIT_KB = 250;
const dist = fileURLToPath(new URL("../dist/", import.meta.url));

/** @type {Record<string, { file: string, isEntry?: boolean, imports?: string[] }>} */
const manifest = JSON.parse(readFileSync(path.join(dist, ".vite", "manifest.json"), "utf8"));

const initial = new Set();
const visit = (key) => {
  const chunk = manifest[key];
  if (chunk === undefined || initial.has(chunk.file)) return;
  initial.add(chunk.file);
  for (const imported of chunk.imports ?? []) visit(imported);
};
for (const [key, chunk] of Object.entries(manifest)) if (chunk.isEntry) visit(key);

let total = 0;
for (const file of [...initial].filter((f) => f.endsWith(".js")).sort()) {
  const size = gzipSync(readFileSync(path.join(dist, file))).length;
  total += size;
  console.log(`${(size / 1024).toFixed(1).padStart(8)} KB  ${file}`);
}
const totalKb = total / 1024;
console.log(`${totalKb.toFixed(1).padStart(8)} KB  JS inicial (gzip), límite ${LIMIT_KB} KB`);
if (totalKb > LIMIT_KB) {
  console.error(`FALLÓ: el JS inicial supera ${LIMIT_KB} KB gzip (RNF-03).`);
  process.exitCode = 1;
}
