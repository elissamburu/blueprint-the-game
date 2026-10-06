// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S2, S3, S4, S6 and S9 of ADR-0025 §4, through app.request over a temporary copy of content/.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErrorResponseSchema } from "../shared/api.js";
import { BODY_LIMIT } from "./app.js";
import { sha256 } from "./content-store.js";
import {
  createWorkspace,
  PORT,
  recordingFs,
  studioHeaders,
  testApp,
  writeHeaders,
  type Workspace,
} from "./testing/workspace.js";

const ID = "static-website-https";
let workspace: Workspace;

beforeEach(async () => {
  workspace = await createWorkspace();
});
afterEach(async () => {
  await workspace.dispose();
});

const putBody = async (yaml?: string) => {
  const current = await workspace.read(ID);
  return JSON.stringify({
    yaml: yaml ?? `${current.toString("utf8")}# cambio\n`,
    baseHash: sha256(current),
  });
};

/** The file is byte for byte what it was and nothing was opened for writing. */
const expectUntouched = async (before: Buffer, calls: { method: string }[]) => {
  expect((await workspace.read(ID)).equals(before)).toBe(true);
  expect(await workspace.tmpFiles(ID)).toEqual([]);
  expect(calls.filter((call) => ["open", "rename", "rm"].includes(call.method))).toEqual([]);
};

describe("S2: DNS rebinding", () => {
  it.each([
    ["a foreign host", { host: `evil.example:${PORT}` }],
    ["127.0.0.1 with another port", { host: "127.0.0.1:4400" }],
    ["localhost without a port", { host: "localhost" }],
    ["127.0.0.1 without a port", { host: "127.0.0.1" }],
  ])("S2: rejects %s with 421", async (_case, { host }) => {
    const app = testApp(workspace);
    for (const url of ["/", "/api/scenarios", `/api/scenarios/${ID}`, "/icons/s3.svg"]) {
      const response = await app.request(url, { headers: studioHeaders({ host }) });
      expect(response.status, url).toBe(421);
      expect(await response.json()).toMatchObject({ error: { code: "misdirected-request" } });
    }
  });

  it("S2: rejects a request without Host with 421", async () => {
    const headers = studioHeaders();
    delete headers.host;
    const response = await testApp(workspace).request("/api/scenarios", { headers });
    expect(response.status).toBe(421);
  });

  it("S2: rejects a foreign Host on a write before touching the disk", async () => {
    const before = await workspace.read(ID);
    const { fs, calls } = recordingFs();
    const response = await testApp(workspace, { fs }).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers: writeHeaders({ host: `evil.example:${PORT}` }),
      body: await putBody(),
    });
    expect(response.status).toBe(421);
    expect(calls).toEqual([]);
    await expectUntouched(before, calls);
  });

  it("S2: accepts 127.0.0.1 and localhost with the server port", async () => {
    const app = testApp(workspace);
    for (const host of [`127.0.0.1:${PORT}`, `localhost:${PORT}`]) {
      const response = await app.request("/api/scenarios", { headers: studioHeaders({ host }) });
      expect(response.status, host).toBe(200);
    }
  });
});

describe("S3: CSRF", () => {
  const refused = [
    ["a foreign Origin", writeHeaders({ origin: "https://evil.example" }), 403],
    ["the Origin of another local port", writeHeaders({ origin: "http://127.0.0.1:4400" }), 403],
    ["Origin null", writeHeaders({ origin: "null" }), 403],
    ["no token", writeHeaders({ "x-studio-token": "" }), 403],
    ["a wrong token", writeHeaders({ "x-studio-token": "nope" }), 403],
    ["Sec-Fetch-Site: cross-site", writeHeaders({ "sec-fetch-site": "cross-site" }), 403],
    ["Sec-Fetch-Site: same-site", writeHeaders({ "sec-fetch-site": "same-site" }), 403],
    ["Content-Type: text/plain", writeHeaders({ "content-type": "text/plain" }), 415],
    [
      "Content-Type: application/x-www-form-urlencoded",
      writeHeaders({ "content-type": "application/x-www-form-urlencoded" }),
      415,
    ],
  ] as const;

  it.each(refused)(
    "S3: rejects a PUT with %s without effects on disk",
    async (_case, headers, status) => {
      const before = await workspace.read(ID);
      const { fs, calls } = recordingFs();
      const response = await testApp(workspace, { fs }).request(`/api/scenarios/${ID}`, {
        method: "PUT",
        headers,
        body: await putBody(),
      });
      expect(response.status).toBe(status);
      expect(calls).toEqual([]);
      await expectUntouched(before, calls);
    },
  );

  it("S3: rejects a PUT without Origin without effects on disk", async () => {
    const before = await workspace.read(ID);
    const headers = writeHeaders();
    delete headers.origin;
    const { fs, calls } = recordingFs();
    const response = await testApp(workspace, { fs }).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers,
      body: await putBody(),
    });
    expect(response.status).toBe(403);
    expect(calls).toEqual([]);
    await expectUntouched(before, calls);
  });

  it("S3: requires the token on GET routes too", async () => {
    const app = testApp(workspace);
    for (const url of ["/api/scenarios", `/api/scenarios/${ID}`, "/api/shared"]) {
      const response = await app.request(url, {
        headers: studioHeaders({ "x-studio-token": "nope" }),
      });
      expect(response.status, url).toBe(403);
      // A code of its own: the UI offers to reload the page instead of retrying with this token.
      expect(ErrorResponseSchema.parse(await response.json()).error.code, url).toBe(
        "invalid-token",
      );
      const missing = studioHeaders();
      delete missing["x-studio-token"];
      expect((await app.request(url, { headers: missing })).status, url).toBe(403);
    }
  });

  it("S3: accepts a PUT from the Studio (localhost origin too)", async () => {
    const response = await testApp(workspace).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers: writeHeaders({
        host: `localhost:${PORT}`,
        origin: `http://localhost:${PORT}`,
        "content-type": "application/json; charset=utf-8",
      }),
      body: await putBody(),
    });
    expect(response.status).toBe(200);
  });

  it("S3: index.html carries the token for the UI", async () => {
    const response = await testApp(workspace).request("/", { headers: studioHeaders() });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain('<meta name="studio-token" content="test-token-');
  });
});

describe("S4: no CORS", () => {
  it("S4: a preflight from another origin gets no Access-Control-Allow-* headers", async () => {
    const response = await testApp(workspace).request(`/api/scenarios/${ID}`, {
      method: "OPTIONS",
      headers: {
        host: `127.0.0.1:${PORT}`,
        origin: "https://evil.example",
        "access-control-request-method": "PUT",
        "access-control-request-headers": "x-studio-token, content-type",
      },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const allow = [...response.headers.keys()].filter((name) =>
      name.toLowerCase().startsWith("access-control-allow"),
    );
    expect(allow).toEqual([]);
  });

  it("S4: no response of the API carries Access-Control-Allow-* headers", async () => {
    const app = testApp(workspace);
    for (const url of ["/", "/api/scenarios", `/api/scenarios/${ID}`, "/api/shared"]) {
      const response = await app.request(url, {
        headers: studioHeaders({ origin: "https://evil.example" }),
      });
      const allow = [...response.headers.keys()].filter((name) =>
        name.startsWith("access-control-allow"),
      );
      expect(allow, url).toEqual([]);
    }
  });
});

describe("S6: body limit", () => {
  it("S6: a body of 1 MiB + 1 byte gets 413 without touching the disk", async () => {
    const before = await workspace.read(ID);
    const { fs, calls } = recordingFs();
    const padding = BODY_LIMIT + 1 - JSON.stringify({ yaml: "", baseHash: "" }).length;
    const body = JSON.stringify({ yaml: "x".repeat(padding), baseHash: "" });
    expect(Buffer.byteLength(body)).toBe(BODY_LIMIT + 1);
    const response = await testApp(workspace, { fs }).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers: writeHeaders(),
      body,
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ error: { code: "payload-too-large" } });
    expect(calls).toEqual([]);
    await expectUntouched(before, calls);
  });

  it("S6: a body of exactly 1 MiB is read", async () => {
    const padding = BODY_LIMIT - JSON.stringify({ yaml: "", baseHash: "" }).length;
    const body = JSON.stringify({ yaml: "x".repeat(padding), baseHash: "" });
    const response = await testApp(workspace).request(`/api/scenarios/${ID}`, {
      method: "PUT",
      headers: writeHeaders(),
      body,
    });
    // Read and refused for its stale hash (S8), not for its size.
    expect(response.status).toBe(409);
  });
});

describe("S9: security headers", () => {
  const expectHeaders = (response: Response, url: string) => {
    expect(response.headers.get("content-security-policy"), url).toBe(
      "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
    );
    expect(response.headers.get("x-content-type-options"), url).toBe("nosniff");
    expect(response.headers.get("referrer-policy"), url).toBe("no-referrer");
  };

  it("S9: headers on /, on /api/* and on error responses", async () => {
    const app = testApp(workspace);
    for (const url of [
      "/",
      "/escenarios/x",
      "/api/scenarios",
      `/api/scenarios/${ID}`,
      "/api/shared",
    ]) {
      const response = await app.request(url, { headers: studioHeaders() });
      expect(response.status, url).toBe(200);
      expectHeaders(response, url);
    }
    const errors = [
      await app.request("/api/scenarios", { headers: studioHeaders({ host: "evil.example" }) }),
      await app.request("/api/scenarios", { headers: studioHeaders({ "x-studio-token": "x" }) }),
      await app.request("/api/scenarios/Nope", { headers: studioHeaders() }),
      await app.request("/api/nothing", { headers: studioHeaders() }),
      await app.request("/favicon.ico", { headers: studioHeaders() }),
    ];
    expect(errors.map((r) => r.status)).toEqual([421, 403, 400, 404, 404]);
    for (const response of errors) expectHeaders(response, response.url);
  });
});
