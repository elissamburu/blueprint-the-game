// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The scenario API over a temporary copy of content/: S5 (path traversal), S8 (never overwrite
// blindly), S10 (validation at the border), the round trip of the 8 scenarios and the generator.
import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderGeneratedFiles } from "@blueprint/content-lint";
import { parseScenario, parseServices } from "@blueprint/scenario-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  ErrorResponseSchema,
  SaveResponseSchema,
  ScenarioFileResponseSchema,
  ScenarioListResponseSchema,
  SharedResponseSchema,
} from "../shared/api.js";
import { sha256 } from "./content-store.js";
import {
  createWorkspace,
  realScenarioIds,
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

const get = (app: ReturnType<typeof testApp>, url: string) =>
  app.request(url, { headers: studioHeaders() });

const put = (app: ReturnType<typeof testApp>, id: string, body: unknown) =>
  app.request(`/api/scenarios/${id}`, {
    method: "PUT",
    headers: writeHeaders(),
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const errorOf = async (response: Response) =>
  ErrorResponseSchema.parse(await response.json()).error;

describe("GET /api/scenarios", () => {
  it("lists every scenario with title, level, status and whether it has errors", async () => {
    const response = await get(testApp(workspace), "/api/scenarios");
    expect(response.status).toBe(200);
    const { scenarios } = ScenarioListResponseSchema.parse(await response.json());
    expect(scenarios.map((s) => s.id)).toEqual(await realScenarioIds());
    const site = scenarios.find((s) => s.id === ID);
    expect(site).toMatchObject({ level: 100, hasErrors: false });
    expect(site?.title).toEqual(expect.any(String));
    expect(scenarios.every((s) => !s.hasErrors)).toBe(true);
  });

  it("marks a scenario with errors and keeps listing the others", async () => {
    await writeFile(workspace.scenarioFile(ID), "id: [roto\n", "utf8");
    const { scenarios } = ScenarioListResponseSchema.parse(
      await (await get(testApp(workspace), "/api/scenarios")).json(),
    );
    expect(scenarios.find((s) => s.id === ID)).toEqual({
      id: ID,
      title: null,
      level: null,
      status: null,
      hasErrors: true,
    });
    expect(scenarios.filter((s) => s.hasErrors)).toHaveLength(1);
  });
});

describe("GET /api/scenarios/:id", () => {
  it("returns the text exactly as it is on disk, its sha256 and notes.md", async () => {
    const bytes = await workspace.read(ID);
    const notes = (await workspace.read(ID, "notes.md")).toString("utf8");
    const body = ScenarioFileResponseSchema.parse(
      await (await get(testApp(workspace), `/api/scenarios/${ID}`)).json(),
    );
    expect(body).toEqual({ id: ID, yaml: bytes.toString("utf8"), hash: sha256(bytes), notes });
  });

  it("notes is null when the scenario has no notes.md", async () => {
    const { rm } = await import("node:fs/promises");
    await rm(workspace.scenarioFile(ID, "notes.md"));
    const body = ScenarioFileResponseSchema.parse(
      await (await get(testApp(workspace), `/api/scenarios/${ID}`)).json(),
    );
    expect(body.notes).toBeNull();
  });

  it("answers 404 for a scenario that does not exist", async () => {
    const response = await get(testApp(workspace), "/api/scenarios/no-existe");
    expect(response.status).toBe(404);
    expect((await errorOf(response)).code).toBe("not-found");
  });
});

describe("GET /api/shared", () => {
  it("returns the shared files parsed with their schemas", async () => {
    const response = await get(testApp(workspace), "/api/shared");
    expect(response.status).toBe(200);
    const shared = SharedResponseSchema.parse(await response.json());
    expect(shared.catalog.length).toBeGreaterThan(10);
    expect(shared.gameRules).toBeDefined();
  });

  it("explains which shared file is broken", async () => {
    await writeFile(path.join(workspace.contentDir, "areas.yaml"), "- id: [", "utf8");
    const response = await get(testApp(workspace), "/api/shared");
    expect(response.status).toBe(500);
    const error = await errorOf(response);
    expect(error.code).toBe("invalid-shared-content");
    expect(error.message).toContain("content/areas.yaml");
  });
});

describe("S5: path traversal", () => {
  const INVALID_IDS = [
    "..%2f..%2fpackage.json",
    "..%2F",
    "..%5C..%5Cpackage.json",
    "%2E%2E%2F",
    "C%3A%5CWindows%5Cwin.ini",
    "%5C%5C%3F%5CC%3A%5Cx",
    "%2Fetc%2Fpasswd",
    "Static-Website",
    "%C3%B1and%C3%BA",
    "caf%C3%A9-1",
    "ab",
    "a".repeat(65),
    "_templates",
    "-abc",
    "abc-",
    "a--bc",
    "abc.yaml",
    "abc%00",
  ];

  it.each(INVALID_IDS)("S5: rejects the id %s with 400 without touching the disk", async (id) => {
    const { fs, calls } = recordingFs();
    const app = testApp(workspace, { fs });
    const read = await get(app, `/api/scenarios/${id}`);
    const write = await put(app, id, { yaml: "x", baseHash: "0".repeat(64) });
    for (const response of [read, write]) {
      expect(response.status).toBe(400);
      expect((await errorOf(response)).code).toBe("invalid-id");
    }
    expect(calls).toEqual([]);
  });

  it.each(["..", "%2e%2e", "%2E%2E"])(
    "S5: the dot segment %s is resolved by the URL parser before routing: 404 without touching the disk",
    async (id) => {
      const { fs, calls } = recordingFs();
      const app = testApp(workspace, { fs });
      expect((await get(app, `/api/scenarios/${id}`)).status).toBe(404);
      expect((await put(app, id, { yaml: "x", baseHash: "0".repeat(64) })).status).toBe(404);
      expect(calls).toEqual([]);
    },
  );

  /** A folder outside content/ with a valid scenario, and a link to it inside content/scenarios/. */
  const linkOutside = async (linkId: string) => {
    const outside = path.join(workspace.root, "outside", linkId);
    await mkdir(outside, { recursive: true });
    const text = (await workspace.read(ID)).toString("utf8").replace(`id: ${ID}`, `id: ${linkId}`);
    await writeFile(path.join(outside, "scenario.yaml"), text, "utf8");
    // A junction on Windows (no privileges needed), a directory symlink elsewhere.
    await symlink(
      outside,
      path.join(workspace.contentDir, "scenarios", linkId),
      process.platform === "win32" ? "junction" : "dir",
    );
    return { outside, text };
  };

  it(`S5: rejects a ${process.platform === "win32" ? "junction" : "symlink"} inside content/scenarios/ that points outside, without reading or writing the target`, async () => {
    const { outside, text } = await linkOutside("escape-link");
    const { fs, calls } = recordingFs();
    const app = testApp(workspace, { fs });

    const read = await get(app, "/api/scenarios/escape-link");
    expect(read.status).toBe(403);
    expect((await errorOf(read)).code).toBe("outside-content");

    const write = await put(app, "escape-link", { yaml: text, baseHash: sha256(text) });
    expect(write.status).toBe(403);

    const touched = calls.filter(
      (call) => call.method !== "realpath" && call.target.startsWith(outside),
    );
    expect(touched).toEqual([]);
    expect(await readFile(path.join(outside, "scenario.yaml"), "utf8")).toBe(text);

    const { scenarios } = ScenarioListResponseSchema.parse(
      await (await get(app, "/api/scenarios")).json(),
    );
    expect(scenarios.map((s) => s.id)).not.toContain("escape-link");
  });

  it("S5: rejects a symlinked scenario.yaml that points outside", async (context) => {
    const outsideFile = path.join(workspace.root, "outside.yaml");
    const text = (await workspace.read(ID)).toString("utf8");
    await writeFile(outsideFile, text, "utf8");
    const dir = path.join(workspace.contentDir, "scenarios", "file-link");
    await mkdir(dir);
    try {
      await symlink(outsideFile, path.join(dir, "scenario.yaml"), "file");
    } catch (error) {
      // File symlinks need Developer Mode or admin rights on Windows.
      if ((error as NodeJS.ErrnoException).code === "EPERM") return context.skip();
      throw error;
    }
    const { fs, calls } = recordingFs();
    const app = testApp(workspace, { fs });
    expect((await get(app, "/api/scenarios/file-link")).status).toBe(403);
    expect((await put(app, "file-link", { yaml: text, baseHash: sha256(text) })).status).toBe(403);
    expect(calls.filter((c) => c.method === "readFile" || c.method === "open")).toEqual([]);
    expect(await readFile(outsideFile, "utf8")).toBe(text);
  });
});

describe("S8: never overwrite blindly", () => {
  it("S8: a save with an old hash gets 409 and the file does not change", async () => {
    const opened = await workspace.read(ID);
    // Someone edits the file on disk after the author opened it.
    const onDisk = `${opened.toString("utf8")}# editado afuera\n`;
    await writeFile(workspace.scenarioFile(ID), onDisk, "utf8");
    const response = await put(testApp(workspace), ID, {
      yaml: opened.toString("utf8"),
      baseHash: sha256(opened),
    });
    expect(response.status).toBe(409);
    expect((await errorOf(response)).code).toBe("conflict");
    expect((await workspace.read(ID)).toString("utf8")).toBe(onDisk);
  });

  it("S8: a save without a hash gets 409 and the file does not change", async () => {
    const before = await workspace.read(ID);
    const response = await put(testApp(workspace), ID, { yaml: "id: otro\n" });
    expect(response.status).toBe(409);
    expect((await workspace.read(ID)).equals(before)).toBe(true);
    expect(await workspace.tmpFiles(ID)).toEqual([]);
  });

  it("S8: there are no routes to delete or rename scenarios", async () => {
    const before = await workspace.read(ID);
    const app = testApp(workspace);
    const attempts = [
      await app.request(`/api/scenarios/${ID}`, { method: "DELETE", headers: writeHeaders() }),
      await app.request(`/api/scenarios/${ID}`, {
        method: "PATCH",
        headers: writeHeaders(),
        body: JSON.stringify({ id: "otro-id" }),
      }),
      await app.request(`/api/scenarios/${ID}`, {
        method: "POST",
        headers: writeHeaders(),
        body: JSON.stringify({}),
      }),
    ];
    for (const response of attempts) expect(response.status).toBe(404);
    expect((await workspace.read(ID)).equals(before)).toBe(true);
  });
});

describe("S10: validation at the border", () => {
  const expectRejected = async (body: unknown, status: number, code: string) => {
    const before = await workspace.read(ID);
    const response = await put(testApp(workspace), ID, body);
    expect(response.status).toBe(status);
    const error = await errorOf(response);
    expect(error.code).toBe(code);
    expect((await workspace.read(ID)).equals(before)).toBe(true);
    expect(await workspace.tmpFiles(ID)).toEqual([]);
    return error;
  };

  it("S10: a YAML with a syntax error gets 422 with its line, without writing", async () => {
    const opened = await workspace.read(ID);
    const lines = opened.toString("utf8").split("\n");
    lines.splice(4, 0, "title: [sin cerrar");
    const error = await expectRejected(
      { yaml: lines.join("\n"), baseHash: sha256(opened) },
      422,
      "invalid-scenario",
    );
    expect(error.message).toContain("YAML inválido");
    expect(error.line).toBeGreaterThanOrEqual(5);
  });

  it("S10: a scenario that fails the schema gets 422, without writing", async () => {
    const opened = await workspace.read(ID);
    const yaml = opened.toString("utf8").replace(/^level: \d+$/m, "level: 250");
    const error = await expectRejected({ yaml, baseHash: sha256(opened) }, 422, "invalid-scenario");
    expect(error.message).toContain("250");
    expect(error.line).toBeGreaterThan(1);
  });

  it("S10: a scenario whose id is not its folder gets 422, without writing", async () => {
    const opened = await workspace.read(ID);
    const yaml = opened.toString("utf8").replace(`id: ${ID}`, "id: otro-escenario");
    const error = await expectRejected({ yaml, baseHash: sha256(opened) }, 422, "invalid-scenario");
    expect(error.message).toContain("otro-escenario");
  });

  it("S10: a body that is not JSON or not { yaml, baseHash } gets 400", async () => {
    await expectRejected("{ no es json", 400, "bad-request");
    await expectRejected({ yaml: 3, baseHash: "x" }, 400, "bad-request");
    await expectRejected({ yaml: "x", baseHash: "x", extra: true }, 400, "bad-request");
  });

  it("S10: lint errors do not block saving a draft", async () => {
    const opened = await workspace.read(ID);
    // L005: a hidden service named in the summary.
    const yaml = opened
      .toString("utf8")
      .replace(/^summary: .*$/m, "summary: Un sitio en Amazon S3 con HTTPS.");
    expect(yaml).not.toBe(opened.toString("utf8"));
    const response = await put(testApp(workspace), ID, { yaml, baseHash: sha256(opened) });
    expect(response.status).toBe(200);
  });
});

describe("PUT /api/scenarios/:id", () => {
  it("opening and saving without changes leaves the 8 scenarios and their generated files identical byte for byte", async () => {
    const ids = await realScenarioIds();
    expect(ids).toHaveLength(8);
    const app = testApp(workspace);
    for (const id of ids) {
      const before = await Promise.all(
        ["scenario.yaml", "diagram.mmd", "README.md"].map((name) => workspace.read(id, name)),
      );
      const opened = ScenarioFileResponseSchema.parse(
        await (await get(app, `/api/scenarios/${id}`)).json(),
      );
      const response = await put(app, id, { yaml: opened.yaml, baseHash: opened.hash });
      expect(response.status, id).toBe(200);
      expect(SaveResponseSchema.parse(await response.json()), id).toEqual({
        hash: opened.hash,
        regenerated: [],
      });
      const after = await Promise.all(
        ["scenario.yaml", "diagram.mmd", "README.md"].map((name) => workspace.read(id, name)),
      );
      after.forEach((bytes, i) =>
        expect(bytes.equals(before[i] ?? Buffer.alloc(0)), id).toBe(true),
      );
      expect(await workspace.tmpFiles(id)).toEqual([]);
    }
  });

  it("keeps CRLF line endings and a BOM byte for byte", async () => {
    const bom = String.fromCharCode(0xfeff);
    const crlf = (await workspace.read(ID)).toString("utf8").replaceAll("\n", "\r\n");
    const text = `${bom}${crlf}`;
    await writeFile(workspace.scenarioFile(ID), text, "utf8");
    const before = await workspace.read(ID);
    const app = testApp(workspace);
    const opened = ScenarioFileResponseSchema.parse(
      await (await get(app, `/api/scenarios/${ID}`)).json(),
    );
    expect((await put(app, ID, { yaml: opened.yaml, baseHash: opened.hash })).status).toBe(200);
    expect((await workspace.read(ID)).equals(before)).toBe(true);
  });

  it("writes the text as sent and regenerates diagram.mmd and README.md", async () => {
    const opened = await workspace.read(ID);
    const yaml = opened
      .toString("utf8")
      .replace(/^title: .*$/m, "title: Sitio estático con HTTPS # comentario conservado");
    const response = await put(testApp(workspace), ID, { yaml, baseHash: sha256(opened) });
    expect(response.status).toBe(200);
    const saved = SaveResponseSchema.parse(await response.json());
    expect(saved).toEqual({ hash: sha256(yaml), regenerated: ["README.md"] });
    expect((await workspace.read(ID)).toString("utf8")).toBe(yaml);

    const scenario = parseScenario(parse(yaml));
    const services = parseServices(
      parse(await readFile(path.join(workspace.contentDir, "catalog", "services.yaml"), "utf8")),
    );
    if (!scenario.success || !services.success) throw new Error("fixture");
    const expected = renderGeneratedFiles(
      scenario.data,
      new Map(services.data.map((s) => [s.id, s])),
    );
    expect((await workspace.read(ID, "README.md")).toString("utf8")).toBe(expected["README.md"]);
    expect((await workspace.read(ID, "diagram.mmd")).toString("utf8")).toBe(
      expected["diagram.mmd"],
    );
  });

  it("creates a missing generated file", async () => {
    const opened = ScenarioFileResponseSchema.parse(
      await (await get(testApp(workspace), `/api/scenarios/${ID}`)).json(),
    );
    const { rm } = await import("node:fs/promises");
    await rm(workspace.scenarioFile(ID, "diagram.mmd"));
    const response = await put(testApp(workspace), ID, {
      yaml: opened.yaml,
      baseHash: opened.hash,
    });
    expect(SaveResponseSchema.parse(await response.json()).regenerated).toEqual(["diagram.mmd"]);
  });
});

describe("GET /icons/:file", () => {
  it("serves an icon by its catalog id and nothing else", async () => {
    const iconsDir = path.join(workspace.root, "icons");
    await mkdir(iconsDir);
    await writeFile(path.join(iconsDir, "s3.svg"), "<svg/>", "utf8");
    await writeFile(path.join(workspace.root, "secret.svg"), "<svg>secret</svg>", "utf8");
    const app = testApp(workspace, { iconsDir });
    const icon = await app.request("/icons/s3.svg", { headers: studioHeaders() });
    expect(icon.status).toBe(200);
    expect(icon.headers.get("content-type")).toBe("image/svg+xml");
    expect(await icon.text()).toBe("<svg/>");
    for (const url of [
      "/icons/..%2fsecret.svg",
      "/icons/S3.svg",
      "/icons/s3.png",
      "/icons/nope.svg",
    ]) {
      expect((await app.request(url, { headers: studioHeaders() })).status, url).toBe(404);
    }
  });
});
