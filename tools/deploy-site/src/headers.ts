// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HTTP headers of every object of the site, by its key in the bucket. Pure: the deploy
// uploads with them and the preview server answers with them.

export const CACHE_CONTROL = {
  /** Vite output with a content hash in its name: a new build means a new name. */
  immutable: "public, max-age=31536000, immutable",
  /** The app shell and the content bundle: always revalidated, so a deploy shows right away. */
  revalidate: "no-cache",
  /** Files with a stable name that rarely change (service icons, favicon). */
  short: "public, max-age=3600",
} as const;

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".woff2": "font/woff2",
};

export interface ObjectHeaders {
  readonly contentType: string;
  readonly cacheControl: string;
}

/** A file of the site with an extension the deploy has no Content-Type for. */
export class UnknownContentTypeError extends Error {
  constructor(readonly key: string) {
    super(
      `No hay un Content-Type definido para "${key}". Agregá su extensión en tools/deploy-site/src/headers.ts.`,
    );
  }
}

const extension = (key: string): string => {
  const name = key.slice(key.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot).toLowerCase();
};

export const contentTypeFor = (key: string): string => {
  const contentType = CONTENT_TYPES[extension(key)];
  if (contentType === undefined) throw new UnknownContentTypeError(key);
  return contentType;
};

/**
 * Vite writes its output to assets/ as <name>-<hash>.<ext>, with a hash of 8 characters.
 * Files of public/ keep their path and never get a hash, so nothing else lands in assets/.
 */
const HASHED_ASSET = /^assets\/(?:.+\/)?[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/;

export const isHashedAsset = (key: string): boolean => HASHED_ASSET.test(key);

export const cacheControlFor = (key: string): string => {
  if (isHashedAsset(key)) return CACHE_CONTROL.immutable;
  if (extension(key) === ".html") return CACHE_CONTROL.revalidate;
  if (key.startsWith("content/") && extension(key) === ".json") return CACHE_CONTROL.revalidate;
  return CACHE_CONTROL.short;
};

/** Headers of the object with this key (relative path with "/", no leading slash). */
export const headersFor = (key: string): ObjectHeaders => ({
  contentType: contentTypeFor(key),
  cacheControl: cacheControlFor(key),
});
