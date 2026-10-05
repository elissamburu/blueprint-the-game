// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, initToken } from "./client";

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api client", () => {
  it("takes the token from index.html, removes the tag and sends it on every request", async () => {
    document.head.innerHTML = '<meta name="studio-token" content="abc123" />';
    initToken();
    expect(document.querySelector('meta[name="studio-token"]')).toBeNull();

    const fetch = respond(200, { scenarios: [] });
    await api.listScenarios();
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("/api/scenarios");
    expect(new Headers(init?.headers).get("X-Studio-Token")).toBe("abc123");
  });

  it("sends saves as JSON with the base hash", async () => {
    const fetch = respond(200, { hash: "a".repeat(64), regenerated: [] });
    await api.saveScenario("abc", { yaml: "x", baseHash: "b".repeat(64) });
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("/api/scenarios/abc");
    expect(init?.method).toBe("PUT");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ yaml: "x", baseHash: "b".repeat(64) });
  });

  it("turns error responses into ApiError with their code", async () => {
    respond(409, { error: { code: "conflict", message: "El archivo cambió en disco." } });
    const error = await api.getScenario("abc").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "conflict" });
  });

  it("refuses a response that does not match its schema", async () => {
    respond(200, { scenarios: [{ id: "../x" }] });
    await expect(api.listScenarios()).rejects.toMatchObject({ code: "internal" });
  });
});
