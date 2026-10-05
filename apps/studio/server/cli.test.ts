// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// S1 (loopback only) and S12 (the token never leaks) on a real server started like `pnpm studio`.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOKEN_HEADER, TOKEN_META } from "../shared/api.js";
import { run } from "./cli.js";
import { HOST, readConfig } from "./config.js";
import type { RunningServer } from "./server.js";
import { createWorkspace, freePort, TEST_CLIENT, type Workspace } from "./testing/workspace.js";

let workspace: Workspace;
let clientDir: string;
const servers: RunningServer[] = [];

beforeEach(async () => {
  workspace = await createWorkspace();
  clientDir = await mkdtemp(path.join(os.tmpdir(), "blueprint-studio-client-"));
  await mkdir(path.join(clientDir, "assets"));
  await writeFile(path.join(clientDir, "index.html"), TEST_CLIENT.indexHtml, "utf8");
});
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await workspace.dispose();
  await rm(clientDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

const start = async (env: Record<string, string> = {}) => {
  const output: string[] = [];
  const port = await freePort();
  const server = await run({
    env: { STUDIO_PORT: String(port), STUDIO_CONTENT_DIR: workspace.contentDir, ...env },
    log: { info: (m) => output.push(m), error: (m) => output.push(m) },
    clientDir,
  });
  if (server === undefined) throw new Error(`the server did not start: ${output.join("\n")}`);
  servers.push(server);
  return { server, port, output };
};

const tokenOf = async (url: string, port: number): Promise<string> => {
  expect(url).toBe(`http://127.0.0.1:${port}`);
  const html = await (await fetch(url)).text();
  const match = new RegExp(`<meta name="${TOKEN_META}" content="([^"]+)"`).exec(html);
  if (match?.[1] === undefined) throw new Error("no token in index.html");
  return match[1];
};

describe("S1: loopback only", () => {
  it("S1: the started server reports 127.0.0.1", async () => {
    const { server, port, output } = await start();
    expect(server.address.address).toBe("127.0.0.1");
    expect(server.url).toBe(`http://127.0.0.1:${port}`);
    expect(output).toContain(`Blueprint Studio: http://127.0.0.1:${port}`);
  });

  it("S1: no option or variable changes the host", async () => {
    const env = {
      HOST: "0.0.0.0",
      HOSTNAME: "0.0.0.0",
      STUDIO_HOST: "0.0.0.0",
      STUDIO_HOSTNAME: "::",
      BIND: "0.0.0.0",
    };
    const { server } = await start(env);
    expect(server.address.address).toBe("127.0.0.1");
    expect(HOST).toBe("127.0.0.1");
    expect(Object.keys(readConfig(env))).toEqual([
      "port",
      "contentDir",
      "iconsDir",
      "gitConfigFiles",
    ]);
  });

  it("S1: only the port is configurable", () => {
    expect(readConfig({ STUDIO_PORT: "5000" }).port).toBe(5000);
    expect(() => readConfig({ STUDIO_PORT: "0.0.0.0:80" })).toThrow("STUDIO_PORT");
  });
});

describe("S12: the token does not leak", () => {
  it("S12: two starts generate different tokens", async () => {
    const first = await start();
    const second = await start();
    const a = await tokenOf(first.server.url, first.port);
    const b = await tokenOf(second.server.url, second.port);
    expect(a).not.toBe(b);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("S12: the output of a whole session, an error included, never contains the token", async () => {
    const written: string[] = [];
    const capture = (stream: NodeJS.WriteStream) =>
      vi.spyOn(stream, "write").mockImplementation((chunk: string | Uint8Array) => {
        written.push(String(chunk));
        return true;
      });
    capture(process.stdout);
    capture(process.stderr);
    for (const method of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        written.push(args.map(String).join(" "));
      });
    }

    const { server, port, output } = await start();
    const token = await tokenOf(server.url, port);
    const headers = {
      [TOKEN_HEADER]: token,
      origin: `http://127.0.0.1:${port}`,
      "content-type": "application/json",
    };
    const api = (url: string, init: RequestInit = {}) =>
      fetch(`${server.url}${url}`, { ...init, headers: { ...headers, ...init.headers } });

    expect((await api("/api/scenarios")).status).toBe(200);
    expect((await api("/api/shared")).status).toBe(200);
    const opened = (await (await api("/api/scenarios/static-website-https")).json()) as {
      yaml: string;
      hash: string;
    };
    const save = (body: unknown) =>
      api("/api/scenarios/static-website-https", { method: "PUT", body: JSON.stringify(body) });
    expect((await save({ yaml: opened.yaml, baseHash: opened.hash })).status).toBe(200);
    expect((await save({ yaml: opened.yaml, baseHash: "0".repeat(64) })).status).toBe(409);
    expect((await save({ yaml: "id: [", baseHash: opened.hash })).status).toBe(422);
    expect((await api("/api/scenarios", { headers: { [TOKEN_HEADER]: `${token}x` } })).status).toBe(
      403,
    );
    // An internal error: scenario.yaml is a folder, so reading it fails and the server logs it.
    await mkdir(path.join(workspace.contentDir, "scenarios", "broken-one", "scenario.yaml"), {
      recursive: true,
    });
    expect((await api("/api/scenarios/broken-one")).status).toBe(500);

    const everything = [...output, ...written].join("\n");
    expect(everything).toContain("Error interno en GET /api/scenarios/broken-one");
    expect(everything).not.toContain(token);
  });
});
