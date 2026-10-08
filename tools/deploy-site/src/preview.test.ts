// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CSP_HEADER, loadCsp, PREVIEW_CSP_VALUES } from "./csp.js";
import { startPreview } from "./preview.js";

let root: string;
let server: Server;
let origin: string;

const write = async (key: string, text: string) => {
  const file = path.join(root, "site", key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
};

beforeAll(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "deploy-site-preview-"));
  await write("index.html", "<!doctype html>app");
  await write("assets/index-BFQKd29Q.js", "js");
  await write("content/index.json", "{}");
  await write("icons/s3.svg", "<svg/>");
  await writeFile(path.join(root, "secret.json"), "{}");
  server = await startPreview({
    siteDir: path.join(root, "site"),
    port: 0,
    csp: PREVIEW_CSP_VALUES,
  });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(root, { recursive: true, force: true });
});

describe("preview server", () => {
  it.each(["/", "/escenarios", "/escenarios/club-photos/resumen?x=1"])(
    "serves the app shell for the route %s, as the CloudFront Function does",
    async (route) => {
      const response = await fetch(`${origin}${route}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("no-cache");
      expect(await response.text()).toBe("<!doctype html>app");
    },
  );

  it("serves each file with the headers of the deploy", async () => {
    const asset = await fetch(`${origin}/assets/index-BFQKd29Q.js`);
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    const content = await fetch(`${origin}/content/index.json`);
    expect(content.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(content.headers.get("cache-control")).toBe("no-cache");
    const icon = await fetch(`${origin}/icons/s3.svg`);
    expect(icon.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("answers 403 for a missing file, never the app shell", async () => {
    const response = await fetch(`${origin}/content/no-existe.v1.json`);
    expect(response.status).toBe(403);
    expect(await response.text()).toContain("AccessDenied");
  });

  it("does not serve files outside the site", async () => {
    const response = await fetch(`${origin}/%2e%2e/secret.json`);
    expect(response.status).toBe(403);
  });

  it("sends the Content-Security-Policy of the policy file on every response, errors included", async () => {
    const policy = await loadCsp(PREVIEW_CSP_VALUES);
    expect(CSP_HEADER).toBe("Content-Security-Policy-Report-Only");
    for (const route of ["/", "/escenarios", "/assets/index-BFQKd29Q.js", "/icons/s3.svg"]) {
      const response = await fetch(`${origin}${route}`);
      expect(response.headers.get(CSP_HEADER), route).toBe(policy);
    }
    const missing = await fetch(`${origin}/content/no-existe.v1.json`);
    expect(missing.status).toBe(403);
    expect(missing.headers.get(CSP_HEADER)).toBe(policy);
    // Report-Only in phase 1: nothing is enforced yet.
    expect(missing.headers.get("content-security-policy")).toBeNull();
  });

  it("only answers GET and HEAD", async () => {
    expect((await fetch(`${origin}/`, { method: "POST" })).status).toBe(405);
    const head = await fetch(`${origin}/`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
  });
});
