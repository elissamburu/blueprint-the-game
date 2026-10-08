// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assemble, AssembleError } from "./assemble.js";

let root: string;
let webDist: string;
let contentDir: string;
let outDir: string;

const write = async (file: string, text = "x") => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
};

const entry = (id: string, status: "draft" | "beta" | "published") => ({
  id,
  version: 1,
  status,
  level: 100,
  areas: ["serverless"],
  title: `Escenario ${id}`,
  summary: "Resumen.",
  estimatedMinutes: 5,
  file: `${id}.v1.json`,
});

const writeContent = async (scenarios: ReturnType<typeof entry>[]) => {
  await write(
    path.join(contentDir, "index.json"),
    JSON.stringify({
      schemaVersion: 1,
      areas: [{ id: "serverless", name: "Serverless" }],
      scenarios,
    }),
  );
  for (const name of ["catalog.json", "game-rules.json", "badges.json"]) {
    await write(path.join(contentDir, name), "{}");
  }
  for (const scenario of scenarios) await write(path.join(contentDir, scenario.file), "{}");
};

const writeWeb = async ({ icons = true } = {}) => {
  await write(path.join(webDist, "index.html"), "<!doctype html>");
  await write(path.join(webDist, "favicon.svg"), "<svg/>");
  await write(path.join(webDist, "assets", "index-BFQKd29Q.js"), "js");
  await write(path.join(webDist, ".vite", "manifest.json"), "{}");
  if (icons) await write(path.join(webDist, "icons", "s3.svg"), "<svg/>");
};

const run = () => assemble({ webDist, contentDir, outDir });

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "deploy-site-"));
  webDist = path.join(root, "web");
  contentDir = path.join(root, "content");
  outDir = path.join(root, "site");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("assemble", () => {
  it("joins the web build and the content bundle in one directory", async () => {
    await writeWeb();
    await writeContent([entry("club-photos", "beta"), entry("photo-queue", "published")]);
    // Something that is not part of the bundle does not reach the site.
    await write(path.join(contentDir, "notes.txt"));
    // A file of a previous build is gone.
    await write(path.join(outDir, "assets", "index-OLDOLDOL.js"));

    const result = await run();

    expect(result.files).toEqual([
      "assets/index-BFQKd29Q.js",
      "content/badges.json",
      "content/catalog.json",
      "content/club-photos.v1.json",
      "content/game-rules.json",
      "content/index.json",
      "content/photo-queue.v1.json",
      "favicon.svg",
      "icons/s3.svg",
      "index.html",
    ]);
    expect(result.icons).toBe(1);
    expect(result.scenarios).toEqual([
      { id: "club-photos", status: "beta" },
      { id: "photo-queue", status: "published" },
    ]);
    expect(await readFile(path.join(outDir, "index.html"), "utf8")).toBe("<!doctype html>");
  });

  it("refuses a bundle built with drafts", async () => {
    await writeWeb();
    await writeContent([entry("club-photos", "beta"), entry("wip", "draft")]);
    await expect(run()).rejects.toThrow(AssembleError);
    await expect(run()).rejects.toThrow("lista borradores (wip)");
  });

  it("refuses a bundle without scenarios", async () => {
    await writeWeb();
    await writeContent([]);
    await expect(run()).rejects.toThrow("no lista ningún escenario");
  });

  it("refuses a bundle that misses the file of a listed scenario", async () => {
    await writeWeb();
    await writeContent([entry("club-photos", "beta")]);
    await rm(path.join(contentDir, "club-photos.v1.json"));
    await expect(run()).rejects.toThrow("club-photos.v1.json en el bundle de contenido");
  });

  it("refuses an invalid or missing index.json", async () => {
    await writeWeb();
    await expect(run()).rejects.toThrow("Corré pnpm build:site (genera el bundle de contenido)");
    await write(path.join(contentDir, "index.json"), "{broken");
    await expect(run()).rejects.toThrow("no es un JSON válido");
    await write(path.join(contentDir, "index.json"), JSON.stringify({ schemaVersion: 99 }));
    await expect(run()).rejects.toThrow("no es válido:");
  });

  it("refuses a web build that is missing or has no icons", async () => {
    await writeContent([entry("club-photos", "beta")]);
    await expect(run()).rejects.toThrow("Corré pnpm build:site (compila la web)");
    await writeWeb({ icons: false });
    await expect(run()).rejects.toThrow("no tiene íconos en /icons");
  });

  it("refuses a file the deploy has no Content-Type for", async () => {
    await writeWeb();
    await writeContent([entry("club-photos", "beta")]);
    await write(path.join(webDist, "video.mp4"));
    await expect(run()).rejects.toThrow('No hay un Content-Type definido para "video.mp4"');
  });
});
