// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadSpaRewrite, SPA_REWRITE_FILE, type ViewerRequestHandler } from "./spa-rewrite.js";

let handler: ViewerRequestHandler;

/** A viewer request event as CloudFront Functions builds it, with the fields the game uses. */
const rewrite = (uri: string) => {
  const request = {
    method: "GET",
    uri,
    querystring: { utm: { value: "x" } },
    headers: { host: { value: "example.com" } },
    cookies: {},
  };
  const result = handler({ request });
  // The same request object comes back: only the uri may change.
  expect(result).toBe(request);
  expect(request.querystring).toEqual({ utm: { value: "x" } });
  return result.uri;
};

beforeAll(async () => {
  handler = await loadSpaRewrite();
});

describe("spa-rewrite (CloudFront Function, viewer request)", () => {
  it.each([
    "/",
    "/bienvenida",
    "/escenarios",
    "/escenarios/",
    "/escenarios/serverless-pdf-processing",
    "/escenarios/serverless-pdf-processing/resumen",
    "/perfil",
    "/acerca",
    "/no-existe",
    // A dot in a folder is not a file extension.
    "/v1.2/escenarios",
  ])("serves the app for the route %s", (uri) => {
    expect(rewrite(uri)).toBe("/index.html");
  });

  it.each([
    "/index.html",
    "/favicon.svg",
    "/assets/index-BFQKd29Q.js",
    "/assets/index-DiHHffOu.css",
    "/content/index.json",
    "/content/serverless-pdf-processing.v1.json",
    "/icons/s3.svg",
    "/manifest.webmanifest",
    // A missing file stays a request for that file: the bucket answers with an error.
    "/content/no-existe.v9.json",
    "/robots.txt",
  ])("leaves the file %s untouched", (uri) => {
    expect(rewrite(uri)).toBe(uri);
  });

  it("uses only what the cloudfront-js-2.0 runtime has: no modules, no Node globals", async () => {
    const source = await readFile(SPA_REWRITE_FILE, "utf8");
    expect(source).toMatch(/^function handler\(event\) \{$/m);
    expect(source).not.toMatch(/\b(import|export|require|process|console)\b/);
  });
});
