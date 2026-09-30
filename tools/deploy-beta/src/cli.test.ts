// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { main, sitePaths } from "./cli.js";

let root: string;

const write = async (file: string, text = "{}") => {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, text);
};

/** A built repo: the web build with an icon and a content bundle with one beta scenario. */
const writeBuild = async () => {
  const { webDist, contentDir } = sitePaths(root);
  await write(path.join(webDist, "index.html"), "<!doctype html>");
  await write(path.join(webDist, "assets", "index-BFQKd29Q.js"), "js");
  await write(path.join(webDist, "icons", "s3.svg"), "<svg/>");
  await write(
    path.join(contentDir, "index.json"),
    JSON.stringify({
      schemaVersion: 1,
      areas: [{ id: "serverless", name: "Serverless" }],
      scenarios: [
        {
          id: "club-photos",
          version: 1,
          status: "beta",
          level: 100,
          areas: ["serverless"],
          title: "Fotos de un club",
          summary: "Resumen.",
          estimatedMinutes: 5,
          file: "club-photos.v1.json",
        },
      ],
    }),
  );
  for (const name of ["catalog.json", "game-rules.json", "badges.json", "club-photos.v1.json"]) {
    await write(path.join(contentDir, name));
  }
};

const run = async (argv: string[], env: NodeJS.ProcessEnv = {}) => {
  let stdout = "";
  let stderr = "";
  const awsCalls: string[][] = [];
  const code = await main(
    argv,
    { stdout: (text) => (stdout += text), stderr: (text) => (stderr += text) },
    {
      repoRoot: root,
      env,
      runAws: (args) => {
        awsCalls.push([...args]);
        const stdout = args[1] === "list-objects-v2" ? "[]" : "I2ABCDEFGH";
        return Promise.resolve({ code: 0, stdout, stderr: "" });
      },
    },
  );
  return { code, stdout, stderr, awsCalls };
};

const ENV = {
  BETA_BUCKET: "blueprint-beta-site",
  BETA_DISTRIBUTION_ID: "E1ABCDEFGHIJKL",
  AWS_PROFILE: "beta-admin",
};

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "deploy-beta-cli-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("assemble", () => {
  it("reports the site it left in dist/beta-site", async () => {
    await writeBuild();
    const { code, stdout, stderr } = await run(["assemble"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toBe(
      "OK: sitio en dist/beta-site (8 archivos; 1 escenario/s: 1 beta; 1 ícono/s).\n",
    );
  });

  it("fails without a stack trace when the build is missing", async () => {
    const { code, stderr } = await run(["assemble"]);
    expect(code).toBe(1);
    expect(stderr).toMatch(/^Error: Falta .*index\.html\. Corré pnpm build:beta/);
    expect(stderr).not.toContain("    at ");
  });
});

describe("deploy", () => {
  it("with --dry-run shows the plan without the variables and without calling AWS", async () => {
    await writeBuild();
    await run(["assemble"]);
    const { code, stdout, stderr, awsCalls } = await run(["deploy", "--dry-run"]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(awsCalls).toEqual([]);
    expect(stdout).toContain(
      "Destino: s3://<BETA_BUCKET> · distribución <BETA_DISTRIBUTION_ID> · perfil <AWS_PROFILE>",
    );
    expect(stdout).toContain("OK (dry-run): 8 archivo/s para subir. No se cambió nada.");
  });

  it("uploads, cleans and invalidates with the variables of the environment", async () => {
    await writeBuild();
    await run(["assemble"]);
    const { code, stdout, awsCalls } = await run(["deploy"], ENV);
    expect(code).toBe(0);
    expect(awsCalls).toHaveLength(8 + 2);
    expect(awsCalls.every((args) => args.at(-1) === "beta-admin")).toBe(true);
    expect(stdout).toContain("OK: 8 archivo/s subido/s, 0 borrado/s, invalidación I2ABCDEFGH.");
  });

  it("fails before calling AWS when a variable is missing or the site is not built", async () => {
    const missing = await run(["deploy"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("Falta BETA_BUCKET");
    const notBuilt = await run(["deploy"], ENV);
    expect(notBuilt.code).toBe(1);
    expect(notBuilt.stderr).toContain("Corré pnpm build:beta antes de pnpm deploy:beta");
    expect(notBuilt.awsCalls).toEqual([]);
  });
});

describe("usage", () => {
  it("prints usage with --help and without a command", async () => {
    expect((await run(["--help"])).stdout).toContain("pnpm build:beta");
    const none = await run([]);
    expect(none.code).toBe(2);
    expect(none.stdout).toContain("pnpm preview:beta");
  });

  it("rejects unknown commands, options and extra arguments", async () => {
    expect((await run(["nope"])).stderr).toContain('Comando desconocido: "nope".');
    expect((await run(["assemble", "--nope"])).code).toBe(2);
    expect((await run(["assemble", "--port", "1"])).stderr).toContain(
      "La opción --port no aplica a assemble.",
    );
    expect((await run(["assemble", "extra"])).stderr).toContain("Argumentos de más para assemble");
    expect((await run(["preview", "--port", "abc"])).stderr).toContain("--port tiene que ser");
    expect((await run(["preview", "--dry-run"])).stderr).toContain(
      "La opción --dry-run no aplica a preview.",
    );
  });
});
