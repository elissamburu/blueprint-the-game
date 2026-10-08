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
 * to the web, so `vite build` does not copy it. BLUEPRINT_CONTENT_DIR (relative to the repo root)
 * makes both serve another bundle: pnpm e2e uses it for its fixture (dist/content-e2e).
 */
const contentBundle = (): Plugin => {
  const override = process.env.BLUEPRINT_CONTENT_DIR;
  const bundleDir = (name: string) =>
    override === undefined || override === ""
      ? path.join(REPO_ROOT, "dist", name)
      : path.resolve(REPO_ROOT, override);
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
      server.middlewares.use(middleware(bundleDir("content-dev")));
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware(bundleDir("content")));
    },
  };
};

/**
 * ADR-0025 §3: CodeMirror and elkjs are Studio-only (over 50 KB gzip each). The build fails if a
 * module of the game's bundle comes from node_modules/@codemirror/ or node_modules/elkjs/; the
 * dependency-cruiser rule `web-not-to-studio-only-deps` checks the imports before building.
 */
const STUDIO_ONLY_MODULE = /[\\/]node_modules[\\/](?:@codemirror[\\/]|elkjs[\\/])/;

const forbidStudioOnlyDeps = (): Plugin => ({
  name: "blueprint-forbid-studio-only-deps",
  apply: "build",
  generateBundle(_options, bundle) {
    const found = Object.values(bundle).flatMap((output) =>
      output.type === "chunk"
        ? output.moduleIds
            .filter((id) => STUDIO_ONLY_MODULE.test(id))
            .map((id) => `${output.fileName}: ${id}`)
        : [],
    );
    if (found.length > 0) {
      this.error(
        `El bundle del juego incluye dependencias exclusivas del Studio (@codemirror/*, elkjs; ADR-0025 §3):\n${found.join("\n")}`,
      );
    }
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), contentBundle(), forbidStudioOnlyDeps()],
  // The manifest lets scripts/check-bundle-size.js measure the initial JS (RNF-03).
  build: { manifest: true },
  resolve: {
    alias: [
      { find: "@", replacement: "/src" },
      // Every `import "zod"` of the game (its packages included) gets Zod without JIT: the CSP of
      // the site has no 'unsafe-eval' (src/zod-jitless.ts, ADR-0028).
      { find: /^zod$/, replacement: path.join(REPO_ROOT, "apps", "web", "src", "zod-jitless.ts") },
    ],
  },
});
