// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  CACHE_CONTROL,
  cacheControlFor,
  contentTypeFor,
  headersFor,
  isHashedAsset,
  UnknownContentTypeError,
} from "./headers.js";

describe("cacheControlFor", () => {
  it.each([
    "assets/index-BFQKd29Q.js",
    "assets/index-DiHHffOu.css",
    "assets/GameScreen-CeJeskZg.css",
    "assets/alert-dialog-D_dlyLBN.js",
    "assets/dist-qic0uLuh.js",
    "assets/fonts/inter-latin-Bq3_x-Yz.woff2",
  ])("caches the hashed asset %s for a year, immutable", (key) => {
    expect(isHashedAsset(key)).toBe(true);
    expect(cacheControlFor(key)).toBe("public, max-age=31536000, immutable");
  });

  it.each([
    "index.html",
    "content/index.json",
    "content/catalog.json",
    "content/game-rules.json",
    "content/badges.json",
    // A scenario file is versioned, but it is part of the content bundle: never cached blindly.
    "content/serverless-pdf-processing.v1.json",
  ])("makes %s revalidate on every request", (key) => {
    expect(cacheControlFor(key)).toBe("no-cache");
  });

  it.each(["icons/s3.svg", "icons/api-gateway.svg", "favicon.svg", "manifest.webmanifest"])(
    "caches %s, a stable name without a hash, for a short time",
    (key) => {
      expect(cacheControlFor(key)).toBe(CACHE_CONTROL.short);
      expect(CACHE_CONTROL.short).toBe("public, max-age=3600");
    },
  );

  it("never treats a file without a hash as immutable", () => {
    // Not in assets/, or without the 8 characters of a Vite hash.
    expect(isHashedAsset("icons/nat-gateway.svg")).toBe(false);
    expect(isHashedAsset("assets/logo.svg")).toBe(false);
    expect(isHashedAsset("assets/index-abc.js")).toBe(false);
    expect(isHashedAsset("content/index-BFQKd29Q.json")).toBe(false);
    expect(isHashedAsset("index-BFQKd29Q.js")).toBe(false);
    expect(cacheControlFor("assets/logo.svg")).toBe(CACHE_CONTROL.short);
  });

  it("only revalidates JSON inside content/", () => {
    expect(cacheControlFor("content/notes.txt")).toBe(CACHE_CONTROL.short);
    expect(cacheControlFor("data.json")).toBe(CACHE_CONTROL.short);
  });
});

describe("contentTypeFor", () => {
  it.each([
    ["icons/s3.svg", "image/svg+xml"],
    ["content/index.json", "application/json; charset=utf-8"],
    ["assets/index-BFQKd29Q.js", "text/javascript; charset=utf-8"],
    ["assets/index-DiHHffOu.css", "text/css; charset=utf-8"],
    ["manifest.webmanifest", "application/manifest+json"],
    ["index.html", "text/html; charset=utf-8"],
    ["ICONS/S3.SVG", "image/svg+xml"],
    ["content/serverless-pdf-processing.v1.json", "application/json; charset=utf-8"],
  ])("%s is %s", (key, contentType) => {
    expect(contentTypeFor(key)).toBe(contentType);
  });

  it.each(["LICENSE", "assets/video.mp4", ".gitkeep", "folder.d/file"])(
    "fails on %s instead of guessing a type",
    (key) => {
      expect(() => contentTypeFor(key)).toThrow(UnknownContentTypeError);
      expect(() => headersFor(key)).toThrow(`No hay un Content-Type definido para "${key}"`);
    },
  );
});

describe("headersFor", () => {
  it("gives both headers of an object", () => {
    expect(headersFor("index.html")).toEqual({
      contentType: "text/html; charset=utf-8",
      cacheControl: "no-cache",
    });
    expect(headersFor("assets/index-BFQKd29Q.js")).toEqual({
      contentType: "text/javascript; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(headersFor("icons/s3.svg")).toEqual({
      contentType: "image/svg+xml",
      cacheControl: "public, max-age=3600",
    });
  });
});
