// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// RF-STU-18: the Scenario Studio is never deployed. The site is built only from apps/web and
// the content bundle, and nothing in that build depends on apps/studio.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REPO_ROOT, sitePaths } from "./cli.js";

const readJson = async (...segments: string[]) =>
  JSON.parse(await readFile(path.join(REPO_ROOT, ...segments), "utf8")) as {
    name?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

describe("the Studio stays out of the site (RF-STU-18)", () => {
  it("build:site builds only the web and its dependencies, and deploy:site does not build", async () => {
    const { scripts = {} } = await readJson("package.json");
    const buildSite = scripts["build:site"] ?? "";
    const filters = [...buildSite.matchAll(/--filter[= ](\S+)/g)].map((match) => match[1]);
    expect(filters.filter((filter) => !filter?.startsWith("@blueprint/tools-"))).toEqual([
      "@blueprint/web...",
    ]);
    expect(buildSite).not.toMatch(/studio/);
    expect(scripts["deploy:site"]).not.toMatch(/studio|turbo run build/);
  });

  it("the web does not depend on the Studio", async () => {
    const web = await readJson("apps", "web", "package.json");
    const studio = await readJson("apps", "studio", "package.json");
    expect(studio.name).toBe("@blueprint/studio");
    expect(Object.keys({ ...web.dependencies, ...web.devDependencies })).not.toContain(studio.name);
  });

  it("the site is assembled only from apps/web/dist and dist/content", () => {
    const paths = sitePaths(REPO_ROOT);
    for (const dir of [paths.webDist, paths.contentDir]) {
      expect(path.relative(REPO_ROOT, dir).split(path.sep)).not.toContain("studio");
    }
  });
});
