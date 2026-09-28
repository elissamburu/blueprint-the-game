// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// End-to-end tests of the three commands against a temporary copy of fixtures/content.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BundleIndex } from "./build.js";
import { createWorkspace, type Workspace } from "./testing/fixture.js";
import type { ValidationReport } from "./validate.js";

const CLUB = ["scenarios", "club-photos", "scenario.yaml"];

let ws: Workspace;

beforeEach(async () => {
  ws = await createWorkspace();
});

afterEach(async () => {
  await ws.dispose();
});

const validateJson = async (...argv: string[]): Promise<ValidationReport> => {
  const { stdout } = await ws.cli("validate", "--format", "json", ...argv);
  return JSON.parse(stdout) as ValidationReport;
};

const codesOf = (report: ValidationReport, id: string): string[] =>
  report.scenarios.find((s) => s.id === id)?.findings.map((f) => f.code) ?? [];

const noStackTrace = (text: string): void => {
  expect(text).not.toMatch(/^\s+at /m);
};

describe("content validate", () => {
  it("passes on the fixtures and ignores folders starting with _", async () => {
    const { code, stdout, stderr } = await ws.cli("validate");
    expect(code).toBe(0);
    expect(stderr).toBe("");
    expect(stdout).toContain("✔ club-photos  (content/scenarios/club-photos/scenario.yaml)");
    expect(stdout).toContain("✔ photo-queue");
    expect(stdout).not.toContain("_templates");
    expect(stdout).toContain("OK: 0 errores, 0 warnings en 2 escenarios.");
    expect(stdout).toContain("✔ Integridad entre archivos compartidos");
    expect(stdout.indexOf("Integridad")).toBeLessThan(stdout.indexOf("club-photos"));
  });

  it("reports integrity errors between shared files in their own block", async () => {
    await ws.edit(["catalog", "categories.yaml"], "adjacent: [database]", "adjacent: [databases]");
    await ws.edit(
      ["catalog", "confusion-groups.yaml"],
      "services: [lambda, ec2, fargate]",
      "services: [lambda, ec2, ecs]",
    );
    const { code, stdout } = await ws.cli("validate");
    expect(code).toBe(1);
    expect(stdout).toContain("✖ Integridad entre archivos compartidos");
    expect(stdout).toContain(
      "error   C002   content/catalog/categories.yaml › [0] (storage).adjacent[0]: ",
    );
    expect(stdout).toContain("error   C003   content/catalog/confusion-groups.yaml › ");
    expect(stdout).toContain("✔ club-photos");
    expect(stdout).toContain("FALLÓ: 2 errores, 0 warnings en 2 escenarios.");

    const report = await validateJson();
    expect(report.integrity).toEqual([
      {
        code: "C002",
        severity: "error",
        message:
          'La categoría "storage" tiene como adyacente a "databases", que no existe en catalog/categories.yaml.',
        file: "content/catalog/categories.yaml",
        where: "[0] (storage).adjacent[0]",
      },
      {
        code: "C003",
        severity: "error",
        message:
          'El grupo de confusión "compute" incluye "ecs", que no existe en catalog/services.yaml.',
        file: "content/catalog/confusion-groups.yaml",
        where: "[0] (compute).services[2]",
      },
    ]);
  });

  it("reports scenario areas missing from areas.yaml as L019", async () => {
    await ws.edit(CLUB, "areas: [serverless, storage]", "areas: [serverless, networking]");
    const report = await validateJson();
    const l019 = report.scenarios[0]?.findings.find((f) => f.code === "L019");
    expect(l019).toMatchObject({ severity: "error", where: "areas[1]" });
  });

  it("reports L014 as skipped when --base is not given", async () => {
    const { stdout } = await ws.cli("validate");
    expect(stdout).toContain("Omitida L014: no se pasó --base <ref>");
    const report = await validateJson();
    expect(report.skipped.map((s) => s.code)).toEqual(["L014"]);
  });

  it("validates a single scenario and accepts the -- separator", async () => {
    const report = await validateJson("--", "photo-queue");
    expect(report.scenarios.map((s) => s.id)).toEqual(["photo-queue"]);
  });

  it("fails clearly when the requested scenario does not exist", async () => {
    const { code, stdout } = await ws.cli("validate", "nope");
    expect(code).toBe(1);
    expect(stdout).toContain('No existe el escenario "nope"');
  });

  it("explains a missing required file without a stack trace", async () => {
    await ws.remove("catalog", "services.yaml");
    const { code, stdout, stderr } = await ws.cli("validate");
    expect(code).toBe(1);
    expect(stdout).toContain("FILE");
    expect(stdout).toContain("Falta el archivo obligatorio content/catalog/services.yaml");
    expect(stdout).toContain("catálogo curado de servicios");
    expect(stdout).toContain("Omitida C001-C010");
    expect(stdout).toContain("Omitida L001-L019");
    expect(stdout).not.toContain("Integridad entre archivos compartidos");
    noStackTrace(stdout + stderr);
  });

  it.each([
    [["areas.yaml"], "áreas de interés"],
    [["game-rules.yaml"], "reglas de juego"],
    [["badges", "badges.yaml"], "insignias"],
    [["catalog", "categories.yaml"], "categorías"],
    [["catalog", "confusion-groups.yaml"], "grupos de servicios que suelen confundirse"],
  ])("explains what the missing %j contains", async (segments, contains) => {
    await ws.remove(...segments);
    const { code, stdout } = await ws.cli("validate");
    expect(code).toBe(1);
    expect(stdout).toContain(`content/${segments.join("/")}`);
    expect(stdout).toContain(contains);
  });

  it("reports a missing content dir without a stack trace", async () => {
    const { code, stdout, stderr } = await ws.cli("validate", "--content", "does-not-exist");
    expect(code).toBe(1);
    expect(stdout).toContain("No existe el directorio de contenido");
    noStackTrace(stdout + stderr);
  });

  it("groups lint errors by scenario with file, path and rule code", async () => {
    await ws.edit(CLUB, 'title: "Fotos de un club de barrio"', 'title: "Fotos en S3"');
    const { code, stdout } = await ws.cli("validate");
    expect(code).toBe(1);
    expect(stdout).toContain("✖ club-photos  (content/scenarios/club-photos/scenario.yaml)");
    expect(stdout).toMatch(/error\s+L005\s+title: /);
    expect(stdout).toContain("✔ photo-queue");
    expect(stdout).toMatch(/FALLÓ: \d+ errores?, 0 warnings en 2 escenarios\./);
  });

  it("reports schema errors with a readable path", async () => {
    await ws.edit(CLUB, "level: 100", "level: 150");
    const report = await validateJson();
    const finding = report.scenarios[0]?.findings[0];
    expect(finding).toMatchObject({ code: "SCHEMA", severity: "error", where: "level" });
    expect(report.ok).toBe(false);
  });

  it("annotates lint paths with node ids", async () => {
    await ws.edit(CLUB, "Pensá en objetos, no en archivos.", "Probá con S3.");
    const report = await validateJson();
    const leak = report.scenarios[0]?.findings.find((f) => f.code === "L005");
    expect(leak?.where).toBe("diagram.nodes[1] (store).hints[0]");
  });

  it("reports YAML syntax errors", async () => {
    await ws.write(CLUB, "id: [unclosed\n");
    const report = await validateJson();
    expect(codesOf(report, "club-photos")).toEqual(["YAML"]);
  });

  it("reports warnings without failing", async () => {
    await ws.edit(CLUB, "El uso es esporádico.", "El uso es esporádico, como con EC2.");
    await ws.cli("gen");
    const { code, stdout } = await ws.cli("validate");
    expect(code).toBe(0);
    expect(stdout).toMatch(/warning\s+L005/);
    expect(stdout).toContain("OK: 0 errores, 1 warning en 2 escenarios.");
  });

  it("reports out-of-date generated files as L012", async () => {
    await ws.edit(CLUB, "Hay que administrar instancias.", "Hay que parchear instancias.");
    const report = await validateJson();
    const l012 = report.scenarios[0]?.findings.filter((f) => f.code === "L012") ?? [];
    expect(l012.map((f) => f.file)).toEqual(["content/scenarios/club-photos/README.md"]);
  });

  it("prints JSON only on stdout", async () => {
    await ws.remove("game-rules.yaml");
    const { code, stdout } = await ws.cli("validate", "--format", "json");
    expect(code).toBe(1);
    const report = JSON.parse(stdout) as ValidationReport;
    expect(report.ok).toBe(false);
    expect(report.summary.errors).toBeGreaterThan(0);
    expect(report.shared[0]).toMatchObject({ code: "FILE", file: "content/game-rules.yaml" });
  });
});

describe("content validate --base (L014)", () => {
  beforeEach(() => {
    ws.git("init", "--quiet", "-b", "main");
    ws.git("add", "-A");
    ws.git("commit", "--quiet", "--no-verify", "-m", "base");
    ws.git("switch", "--quiet", "-c", "feature");
  });

  const promoteFargate = () =>
    ws.edit(CLUB, "        - service: fargate\n          grade: acceptable", "        - service: fargate\n          grade: optimal");

  it("fails when a beta scenario changes grades without bumping version", async () => {
    await promoteFargate();
    const report = await validateJson("--base", "main");
    expect(report.skipped).toEqual([]);
    expect(codesOf(report, "club-photos")).toContain("L014");
    const l014 = report.scenarios[0]?.findings.find((f) => f.code === "L014");
    expect(l014?.message).toContain('answers o grados de "thumbnailer"');
  });

  it("passes when version is bumped", async () => {
    await promoteFargate();
    await ws.edit(CLUB, "version: 1", "version: 2");
    const report = await validateJson("--base", "main");
    expect(codesOf(report, "club-photos")).not.toContain("L014");
  });

  it("ignores text-only changes and scenarios that are new or draft on the base", async () => {
    await ws.edit(CLUB, "Hay que administrar instancias.", "Hay que parchear instancias.");
    await ws.edit(
      ["scenarios", "photo-queue", "scenario.yaml"],
      "        - service: dynamodb\n",
      "        - service: s3\n",
    );
    const report = await validateJson("--base", "main");
    expect(codesOf(report, "club-photos")).not.toContain("L014");
    expect(codesOf(report, "photo-queue")).not.toContain("L014");
  });

  it("fails when the base ref does not exist", async () => {
    const { code, stdout } = await ws.cli("validate", "--base", "origin/nope");
    expect(code).toBe(1);
    expect(stdout).toMatch(/error\s+GIT\s+content: La ref base "origin\/nope" no existe/);
    expect(stdout).toContain("Omitida L014: no se pudo leer la ref base (ver el error GIT).");
  });

  it("never treats a ref as a git option", async () => {
    const { code, stdout } = await ws.cli("validate", "--base=--output=x");
    expect(code).toBe(1);
    expect(stdout).toContain('La ref base "--output=x" no existe');
  });
});

describe("content gen", () => {
  it("--check passes when generated files are up to date", async () => {
    const { code, stdout } = await ws.cli("gen", "--check");
    expect(code).toBe(0);
    expect(stdout).toContain("OK: 4 archivo/s generado/s al día.");
  });

  it("--check fails on outdated or missing files and does not write", async () => {
    await ws.edit(CLUB, "Hay que administrar instancias.", "Hay que parchear instancias.");
    await ws.remove("scenarios", "photo-queue", "diagram.mmd");
    const before = await ws.read("scenarios", "club-photos", "README.md");
    const { code, stdout } = await ws.cli("gen", "--check");
    expect(code).toBe(1);
    expect(stdout).toContain("content/scenarios/club-photos/README.md no coincide");
    expect(stdout).toContain("Falta el archivo generado content/scenarios/photo-queue/diagram.mmd");
    expect(await ws.read("scenarios", "club-photos", "README.md")).toBe(before);
    await expect(stat(ws.file("scenarios", "photo-queue", "diagram.mmd"))).rejects.toThrow();
  });

  it("writes only what changed, then --check passes", async () => {
    await ws.edit(CLUB, "Hay que administrar instancias.", "Hay que parchear instancias.");
    const { code, stdout } = await ws.cli("gen");
    expect(code).toBe(0);
    expect(stdout).toContain("escrito content/scenarios/club-photos/README.md");
    expect(stdout).toContain("OK: 1 archivo/s escrito/s, 3 sin cambios.");
    expect((await ws.cli("gen", "--check")).code).toBe(0);
  });

  it("accepts CRLF checkouts as up to date", async () => {
    const readme = await ws.read("scenarios", "club-photos", "README.md");
    await ws.write(["scenarios", "club-photos", "README.md"], readme.replace(/\n/g, "\r\n"));
    expect((await ws.cli("gen", "--check")).code).toBe(0);
  });

  it("fails without a valid catalog and explains why", async () => {
    await ws.remove("catalog", "services.yaml");
    const { code, stdout } = await ws.cli("gen");
    expect(code).toBe(1);
    expect(stdout).toContain("Falta el archivo obligatorio content/catalog/services.yaml");
  });

  it("skips invalid scenarios with an error", async () => {
    await ws.edit(CLUB, "level: 100", "level: 150");
    const { code, stdout } = await ws.cli("gen");
    expect(code).toBe(1);
    expect(stdout).toContain('No se generan los archivos de "club-photos"');
  });
});

describe("content build", () => {
  const readIndex = async (): Promise<BundleIndex> =>
    JSON.parse(await readFile(path.join(ws.outDir, "index.json"), "utf8")) as BundleIndex;

  it("leaves drafts out by default and lists only beta and published scenarios", async () => {
    const { code, stdout } = await ws.cli("build");
    expect(code).toBe(0);
    expect(stdout).toContain("5 archivos; 1 escenario/s en index.json");
    expect(stdout).toContain("1 draft/s excluido/s (usá --include-drafts en desarrollo local)");
    expect((await readdir(ws.outDir)).sort()).toEqual([
      "badges.json",
      "catalog.json",
      "club-photos.v1.json",
      "game-rules.json",
      "index.json",
    ]);
    const index = await readIndex();
    expect(index.scenarios.map((s) => [s.id, s.status, s.file])).toEqual([
      ["club-photos", "beta", "club-photos.v1.json"],
    ]);
    const catalog = JSON.parse(await readFile(path.join(ws.outDir, "catalog.json"), "utf8")) as {
      services: unknown[];
    };
    expect(catalog.services).toHaveLength(8);
  });

  it("bundles and lists drafts with --include-drafts", async () => {
    const { code, stdout } = await ws.cli("build", "--include-drafts");
    expect(code).toBe(0);
    expect(stdout).toContain("6 archivos; 2 escenario/s en index.json).\n");
    expect(await readdir(ws.outDir)).toContain("photo-queue.v1.json");
    const index = await readIndex();
    expect(index.scenarios.map((s) => [s.id, s.status])).toEqual([
      ["club-photos", "beta"],
      ["photo-queue", "draft"],
    ]);
  });

  it("keeps the JSON of retired scenarios but does not list them", async () => {
    await ws.edit(CLUB, "status: beta", "status: retired");
    await ws.cli("gen");
    const { code, stdout } = await ws.cli("build");
    expect(code).toBe(0);
    expect(stdout).toContain("5 archivos; 0 escenario/s en index.json");
    expect(await readdir(ws.outDir)).toContain("club-photos.v1.json");
    expect((await readIndex()).scenarios).toEqual([]);
  });

  it("removes a draft written by a previous --include-drafts build", async () => {
    await ws.cli("build", "--include-drafts");
    await ws.cli("build");
    expect(await readdir(ws.outDir)).not.toContain("photo-queue.v1.json");
  });

  it("is deterministic and removes stale scenario files", async () => {
    await ws.cli("build");
    const first = await readFile(path.join(ws.outDir, "club-photos.v1.json"), "utf8");
    await ws.edit(CLUB, "version: 1", "version: 2");
    await ws.cli("gen");
    await ws.cli("build");
    const files = await readdir(ws.outDir);
    expect(files).toContain("club-photos.v2.json");
    expect(files).not.toContain("club-photos.v1.json");
    const second = await readFile(path.join(ws.outDir, "club-photos.v2.json"), "utf8");
    expect(second.replace('"version": 2', '"version": 1')).toBe(first);
  });

  it("fails and writes nothing when validation has errors", async () => {
    await ws.edit(CLUB, 'title: "Fotos de un club de barrio"', 'title: "Fotos en S3"');
    const { code, stdout } = await ws.cli("build");
    expect(code).toBe(1);
    expect(stdout).toContain("L005");
    expect(stdout).toContain("FALLÓ: content:build necesita que content:validate pase sin errores.");
    await expect(stat(ws.outDir)).rejects.toThrow();
  });
});

describe("usage", () => {
  it.each([
    [["frobnicate"], "Comando desconocido"],
    [["validate", "--nope"], "--nope"],
    [["validate", "--check"], "--check no aplica a validate"],
    [["gen", "--include-drafts"], "--include-drafts no aplica a gen"],
    [["validate", "--format", "xml"], '--format tiene que ser "text" o "json"'],
    [["gen", "extra"], "Argumentos de más"],
  ])("rejects %j with exit code 2", async (argv, message) => {
    const { code, stderr } = await ws.cli(...argv);
    expect(code).toBe(2);
    expect(stderr).toContain(message);
    expect(stderr).toContain("Uso:");
  });

  it("prints help", async () => {
    const { code, stdout } = await ws.cli("--help");
    expect(code).toBe(0);
    expect(stdout).toContain("pnpm content:validate");
  });
});
