// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Connect, type Plugin } from "vite";

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/**
 * Serves the content:build bundle under /content/ as static files: the game fetches and
 * validates it at runtime instead of importing it (ADR-0006). `vite dev` serves
 * dist/content-dev (built with --include-drafts by the dev script); `vite preview` serves
 * dist/content, the production bundle. In production the deploy publishes dist/content next
 * to the web, so `vite build` does not copy it.
 */
const contentBundle = (): Plugin => {
  const middleware =
    (dir: string): Connect.NextHandleFunction =>
    (req, res: ServerResponse, next) => {
      const match = /^\/content\/([a-z0-9.-]+\.json)(?:\?.*)?$/.exec(req.url ?? "");
      if (match?.[1] === undefined) return next();
      readFile(path.join(dir, match[1]))
        .then((body) => {
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.end(body);
        })
        .catch(() => {
          res.statusCode = 404;
          res.end("Not found");
        });
    };
  return {
    name: "blueprint-content-bundle",
    configureServer(server) {
      server.middlewares.use(middleware(path.join(REPO_ROOT, "dist", "content-dev")));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(path.join(REPO_ROOT, "dist", "content")));
    },
  };
};

export default defineConfig({
  plugins: [react(), tailwindcss(), contentBundle()],
  // The manifest lets scripts/check-bundle-size.js measure the initial JS (RNF-03).
  build: { manifest: true },
  resolve: {
    alias: { "@": "/src" },
  },
});
