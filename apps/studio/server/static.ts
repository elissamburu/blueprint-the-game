// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The only files the server serves besides /api (ADR-0025 §4): the built UI (index.html and
// dist/client/assets) and /icons/<id>.svg from apps/web/public/icons. Names are matched against
// closed patterns and every resolved path has to stay inside its folder after realpath.
import path from "node:path";
import type { Hono } from "hono";
import { TOKEN_META } from "../shared/api.js";
import { isNotFound, type ContentFs } from "./fs.js";
import { isInside } from "./paths.js";

/** Same pattern as the ids of the catalog (kebab-case). */
const ICON_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/;
/** Files Vite writes to dist/client/assets: `index-<hash>.js`, `index-<hash>.css`, … */
const ASSET_FILE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(js|css|svg|woff2)$/;

const CONTENT_TYPES: Record<string, string> = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  woff2: "font/woff2",
};

export interface ClientFiles {
  /** dist/client/index.html as built by Vite. */
  indexHtml: string;
  /** dist/client/assets */
  assetsDir: string;
}

/**
 * index.html with the session token in a meta tag (S3). The page reads it once; another site
 * cannot read this response (same-origin policy) nor get it by rebinding (S2).
 */
export const injectToken = (html: string, token: string): string =>
  html.replace("</head>", `  <meta name="${TOKEN_META}" content="${token}" />\n  </head>`);

const readInside = async (
  fs: ContentFs,
  dir: string,
  name: string,
): Promise<Buffer | undefined> => {
  const target = path.resolve(dir, name);
  if (!isInside(dir, target)) return undefined;
  try {
    const [realDir, realTarget] = await Promise.all([fs.realpath(dir), fs.realpath(target)]);
    if (!isInside(realDir, realTarget)) return undefined;
    return await fs.readFile(realTarget);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
};

export const registerIcons = (app: Hono, fs: ContentFs, iconsDir: string): void => {
  app.get("/icons/:file", async (c) => {
    const file = c.req.param("file");
    const body = ICON_FILE.test(file) ? await readInside(fs, iconsDir, file) : undefined;
    if (body === undefined) return c.notFound();
    return c.body(new Uint8Array(body), 200, {
      "Content-Type": CONTENT_TYPES.svg ?? "image/svg+xml",
      "Cache-Control": "no-cache",
    });
  });
};

export const registerClient = (
  app: Hono,
  fs: ContentFs,
  client: ClientFiles,
  token: string,
): void => {
  const html = injectToken(client.indexHtml, token);

  app.get("/assets/:file", async (c) => {
    const file = c.req.param("file");
    const match = ASSET_FILE.exec(file);
    const body = match === null ? undefined : await readInside(fs, client.assetsDir, file);
    if (match === null || body === undefined) return c.notFound();
    return c.body(new Uint8Array(body), 200, {
      "Content-Type": CONTENT_TYPES[match[1] ?? ""] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    });
  });

  // Routes of the UI (React Router): any other GET without a file extension gets index.html.
  app.get("*", (c) => {
    const last = c.req.path.split("/").at(-1) ?? "";
    if (c.req.path.startsWith("/api/") || last.includes(".")) return c.notFound();
    return c.html(html, 200, { "Cache-Control": "no-store" });
  });
};
