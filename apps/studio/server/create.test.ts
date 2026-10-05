// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// POST /api/scenarios (RF-STU-01) over a temporary copy of content/: empty, from a template and
// duplicating; S5 (the new id before touching the disk), S7 (atomic write), S8 (exclusive mkdir,
// the original untouched) and S10 (the server writes its own text), and the author from git.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GENERATED_FILES, renderGeneratedFiles } from "@blueprint/content-lint";
import { parseScenario, parseServices } from "@blueprint/scenario-schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import {
  CreateResponseSchema,
  ErrorResponseSchema,
  ScenarioFileResponseSchema,
  ScenarioListResponseSchema,
} from "../shared/api.js";
import { EMPTY_SCENARIO } from "./new-scenario.js";
import {
  createWorkspace,
  recordingFs,
  studioHeaders,
  testApp,
  writeHeaders,
  type Workspace,
} from "./testing/workspace.js";
import type { ContentFs } from "./fs.js";

const ORIGINAL = "static-website-https";
const NEW_ID = "mi-escenario-nuevo";
const TITLE = "Un escenario nuevo";
const AUTHOR = "octo-cat";

let workspace: Workspace;
/** A global git config with a GitHub user, as the server reads it (S11: a file, no process). */
let gitConfig: string;

beforeEach(async () => {
  workspace = await createWorkspace();
  gitConfig = path.join(workspace.root, ".gitconfig");
  await writeFile(gitConfig, `[user]\n\tname = ${AUTHOR}\n`, "utf8");
});
afterEach(async () => {
  await workspace.dispose();
});

const app = (options: { fs?: ContentFs; gitConfigFiles?: string[] } = {}) =>
  testApp(workspace, { gitConfigFiles: [gitConfig], ...options });

const post = (target: ReturnType<typeof testApp>, body: unknown, headers = writeHeaders()) =>
  target.request("/api/scenarios", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const created = async (response: Response) => {
  expect(response.status).toBe(201);
  return CreateResponseSchema.parse(await response.json());
};

const errorOf = async (response: Response) =>
  ErrorResponseSchema.parse(await response.json()).error;

const scenarioDirs = async () =>
  (await readdir(path.join(workspace.contentDir, "scenarios"))).sort();

const filesOf = async (id: string) =>
  (await readdir(path.join(workspace.contentDir, "scenarios", id))).sort();

const data = async (id: string) =>
  parse((await workspace.read(id)).toString("utf8")) as Record<string, unknown>;

/** The bytes of every file of a scenario folder. */
const snapshot = async (id: string) =>
  Object.fromEntries(
    await Promise.all(
      (await filesOf(id)).map(async (name) => [name, await workspace.read(id, name)] as const),
    ),
  );

const expectedGenerated = async (id: string) => {
  const scenario = parseScenario(await data(id));
  const services = parseServices(
    parse(await readFile(path.join(workspace.contentDir, "catalog", "services.yaml"), "utf8")),
  );
  if (!scenario.success || !services.success) throw new Error("fixture");
  return renderGeneratedFiles(scenario.data, new Map(services.data.map((s) => [s.id, s])));
};

describe("POST /api/scenarios", () => {
  it("creates an empty scenario: draft, version 1, the new id and title and the git user", async () => {
    const before = await scenarioDirs();
    const body = await created(await post(app(), { id: NEW_ID, title: TITLE, source: "empty" }));
    // The empty scenario does not pass the schema yet: no generated files until it is saved.
    expect(body).toEqual({ id: NEW_ID, author: AUTHOR, generated: [] });
    expect(await scenarioDirs()).toEqual([...before, NEW_ID].sort());
    expect(await filesOf(NEW_ID)).toEqual(["scenario.yaml"]);
    expect(await data(NEW_ID)).toMatchObject({
      schemaVersion: 1,
      id: NEW_ID,
      version: 1,
      status: "draft",
      title: TITLE,
      authors: [{ github: AUTHOR }],
      objectives: [],
      diagram: { nodes: [], edges: [], groups: [] },
    });
    // Only the five keys changed: the rest of the empty scenario is as written.
    const text = (await workspace.read(NEW_ID)).toString("utf8");
    expect(text.split("\n").slice(0, 3)).toEqual(EMPTY_SCENARIO.split("\n").slice(0, 3));
    expect(text).toContain(`title: "${TITLE}"\n`);

    // Listed with errors (without a title until it passes the schema), and the editor opens it.
    const { scenarios } = ScenarioListResponseSchema.parse(
      await (await app().request("/api/scenarios", { headers: studioHeaders() })).json(),
    );
    expect(scenarios.find((s) => s.id === NEW_ID)).toMatchObject({ hasErrors: true });
    const opened = ScenarioFileResponseSchema.parse(
      await (await app().request(`/api/scenarios/${NEW_ID}`, { headers: studioHeaders() })).json(),
    );
    expect(opened).toMatchObject({ id: NEW_ID, yaml: text, notes: null });
  });

  it("creates from the template, keeping its comments, and writes the generated files", async () => {
    const template = await readFile(
      path.join(workspace.contentDir, "scenarios", "_templates", "scenario.template.yaml"),
      "utf8",
    );
    const body = await created(
      await post(app(), { id: NEW_ID, title: TITLE, source: "template", from: "scenario" }),
    );
    expect(body).toEqual({ id: NEW_ID, author: AUTHOR, generated: [...GENERATED_FILES] });
    expect(await filesOf(NEW_ID)).toEqual(["README.md", "diagram.mmd", "scenario.yaml"]);
    const text = (await workspace.read(NEW_ID)).toString("utf8");
    const comments = (yaml: string) =>
      yaml.split("\n").filter((line) => line.trimStart().startsWith("#"));
    expect(comments(text)).toEqual(comments(template));
    expect(await data(NEW_ID)).toMatchObject({
      id: NEW_ID,
      version: 1,
      status: "draft",
      title: TITLE,
      authors: [{ github: AUTHOR }],
    });
    const expected = await expectedGenerated(NEW_ID);
    for (const name of GENERATED_FILES) {
      expect((await workspace.read(NEW_ID, name)).toString("utf8")).toBe(expected[name]);
    }
    // The template is still there, as it was.
    expect(
      await readFile(
        path.join(workspace.contentDir, "scenarios", "_templates", "scenario.template.yaml"),
        "utf8",
      ),
    ).toBe(template);
  });

  it("duplicates a scenario without touching the original", async () => {
    const original = await snapshot(ORIGINAL);
    const originalText = original["scenario.yaml"]?.toString("utf8") ?? "";
    const body = await created(
      await post(app(), { id: NEW_ID, title: TITLE, source: "duplicate", from: ORIGINAL }),
    );
    expect(body).toEqual({ id: NEW_ID, author: AUTHOR, generated: [...GENERATED_FILES] });
    expect(await snapshot(ORIGINAL)).toEqual(original);

    // notes.md belongs to the original: it is not copied.
    expect(await filesOf(NEW_ID)).toEqual(["README.md", "diagram.mmd", "scenario.yaml"]);
    const copy = await data(NEW_ID);
    const source = parse(originalText) as Record<string, unknown>;
    expect(copy).toEqual({
      ...source,
      id: NEW_ID,
      title: TITLE,
      status: "draft",
      version: 1,
      authors: [{ github: AUTHOR }],
    });
    // Line by line, only id, status, title and the author differ.
    const before = originalText.split("\n");
    const after = (await workspace.read(NEW_ID)).toString("utf8").split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.filter((line, i) => line !== before[i]);
    expect(changed).toEqual([
      `id: ${NEW_ID}`,
      "status: draft",
      `title: "${TITLE}"`,
      `  - github: ${AUTHOR}`,
    ]);
    const expected = await expectedGenerated(NEW_ID);
    expect((await workspace.read(NEW_ID, "diagram.mmd")).toString("utf8")).toBe(
      expected["diagram.mmd"],
    );
  });

  it("without a GitHub user in the git config, authors stays empty", async () => {
    await writeFile(gitConfig, "[user]\n\tname = Ada Lovelace\n", "utf8");
    const body = await created(
      await post(app(), { id: NEW_ID, title: TITLE, source: "duplicate", from: ORIGINAL }),
    );
    // Without an author the copy does not pass the schema: no generated files yet.
    expect(body).toEqual({ id: NEW_ID, author: null, generated: [] });
    expect((await data(NEW_ID)).authors).toEqual([]);

    const none = await created(
      await post(app({ gitConfigFiles: [] }), { id: "otro-nuevo", title: TITLE, source: "empty" }),
    );
    expect(none.author).toBeNull();
  });

  it("the repo's .git/config overrides the global file", async () => {
    const repoConfig = path.join(workspace.root, "repo-config");
    await writeFile(repoConfig, "[user]\n\tname = repo-user\n", "utf8");
    const body = await created(
      await post(app({ gitConfigFiles: [gitConfig, repoConfig] }), {
        id: NEW_ID,
        title: TITLE,
        source: "empty",
      }),
    );
    expect(body.author).toBe("repo-user");
  });

  it("answers 404 for a scenario to duplicate that does not exist, without creating anything", async () => {
    const before = await scenarioDirs();
    const response = await post(app(), {
      id: NEW_ID,
      title: TITLE,
      source: "duplicate",
      from: "no-existe",
    });
    expect(response.status).toBe(404);
    expect(await scenarioDirs()).toEqual(before);
  });

  it("answers 404 for a missing template, without creating anything", async () => {
    await rm(path.join(workspace.contentDir, "scenarios", "_templates", "scenario.template.yaml"));
    const before = await scenarioDirs();
    const response = await post(app(), {
      id: NEW_ID,
      title: TITLE,
      source: "template",
      from: "scenario",
    });
    expect(response.status).toBe(404);
    expect(await scenarioDirs()).toEqual(before);
  });

  it("S10: duplicating a scenario whose YAML does not parse gets 422, without creating anything", async () => {
    await writeFile(workspace.scenarioFile(ORIGINAL), "id: [roto\n", "utf8");
    const before = await scenarioDirs();
    const response = await post(app(), {
      id: NEW_ID,
      title: TITLE,
      source: "duplicate",
      from: ORIGINAL,
    });
    expect(response.status).toBe(422);
    expect((await errorOf(response)).code).toBe("invalid-scenario");
    expect(await scenarioDirs()).toEqual(before);
  });
});

describe("S8: creating never overwrites", () => {
  it("S8: an id that already exists gets 409 and the existing scenario does not change", async () => {
    const original = await snapshot(ORIGINAL);
    for (const source of [
      { source: "empty" },
      { source: "template", from: "scenario" },
      { source: "duplicate", from: ORIGINAL },
    ]) {
      const response = await post(app(), { id: ORIGINAL, title: TITLE, ...source });
      expect(response.status, source.source).toBe(409);
      expect((await errorOf(response)).code).toBe("conflict");
    }
    expect(await snapshot(ORIGINAL)).toEqual(original);
    expect(await workspace.tmpFiles(ORIGINAL)).toEqual([]);
  });

  it("S8: a file with the name of the new id is not replaced either", async () => {
    const file = path.join(workspace.contentDir, "scenarios", NEW_ID);
    await writeFile(file, "no soy una carpeta", "utf8");
    const response = await post(app(), { id: NEW_ID, title: TITLE, source: "empty" });
    expect(response.status).toBe(409);
    expect(await readFile(file, "utf8")).toBe("no soy una carpeta");
  });
});

describe("S5: the new id is validated before touching the disk", () => {
  const INVALID_IDS = [
    "../fuera",
    "..\\fuera",
    "C:\\Windows",
    "\\\\?\\C:\\x",
    "/etc/passwd",
    "Mayusculas",
    "cañón",
    "ab",
    "a".repeat(65),
    "_templates",
    "-abc",
    "abc-",
    "a--bc",
    "abc.yaml",
    "abc\u0000",
    "",
    42,
    null,
  ];

  it.each(INVALID_IDS)(
    "S5: rejects the new id %j with 400 without touching the disk",
    async (id) => {
      const { fs, calls } = recordingFs();
      const response = await post(app({ fs }), { id, title: TITLE, source: "empty" });
      expect(response.status).toBe(400);
      expect((await errorOf(response)).code).toBe("invalid-id");
      expect(calls).toEqual([]);
    },
  );

  it.each(INVALID_IDS)(
    "S5: rejects duplicating the id %j with 400 without touching the disk",
    async (from) => {
      const { fs, calls } = recordingFs();
      const response = await post(app({ fs }), {
        id: NEW_ID,
        title: TITLE,
        source: "duplicate",
        from,
      });
      expect(response.status).toBe(400);
      expect((await errorOf(response)).code).toBe("invalid-id");
      expect(calls).toEqual([]);
    },
  );

  it.each([
    ["a template outside the closed list", { source: "template", from: "../scenario" }],
    ["another template name", { source: "template", from: "otra" }],
    ["an unknown source", { source: "copy", from: ORIGINAL }],
    ["from with an empty scenario", { source: "empty", from: ORIGINAL }],
    ["a template without its name", { source: "template" }],
    ["a body with YAML", { source: "empty", yaml: "id: x\n" }],
  ])("S10: rejects %s with 400 without touching the disk", async (_, fields) => {
    const { fs, calls } = recordingFs();
    const response = await post(app({ fs }), { id: NEW_ID, title: TITLE, ...fields });
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("bad-request");
    expect(calls).toEqual([]);
  });

  it.each([
    ["no title", { id: NEW_ID, source: "empty" }],
    ["a blank title", { id: NEW_ID, title: "   ", source: "empty" }],
    ["a title too long", { id: NEW_ID, title: "x".repeat(1000), source: "empty" }],
  ])("S10: rejects %s with 400 without touching the disk", async (_, body) => {
    const { fs, calls } = recordingFs();
    const response = await post(app({ fs }), body);
    expect(response.status).toBe(400);
    expect(calls).toEqual([]);
  });

  it("S10: a body that is not JSON gets 400", async () => {
    const response = await post(app(), "{ no es json");
    expect(response.status).toBe(400);
    expect((await errorOf(response)).code).toBe("bad-request");
  });
});

describe("S3 and S7 when creating", () => {
  it("S3: a POST from another origin or without the token creates nothing", async () => {
    const before = await scenarioDirs();
    const body = { id: NEW_ID, title: TITLE, source: "empty" };
    const foreign = await post(app(), body, writeHeaders({ origin: "http://evil.example" }));
    const noToken = await post(app(), body, writeHeaders({ "x-studio-token": "otro" }));
    expect(foreign.status).toBe(403);
    expect(noToken.status).toBe(403);
    expect(await scenarioDirs()).toEqual(before);
  });

  it("S7: if writing scenario.yaml fails, no folder and no temporary file are left", async () => {
    const before = await scenarioDirs();
    const { fs } = recordingFs({
      rename: () => Promise.reject(Object.assign(new Error("disk full"), { code: "ENOSPC" })),
    });
    const response = await post(app({ fs }), { id: NEW_ID, title: TITLE, source: "empty" });
    expect(response.status).toBe(500);
    expect(await scenarioDirs()).toEqual(before);
  });
});
