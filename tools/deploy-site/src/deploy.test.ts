// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deploy,
  DeployError,
  FAKE_AUTH_MARKER,
  INVALIDATION_PATHS,
  invalidationArgs,
  listArgs,
  planUploads,
  readTarget,
  removeArgs,
  staleKeys,
  uploadArgs,
  type AwsResult,
  type DeployTarget,
} from "./deploy.js";
import { REPO_ROOT } from "./cli.js";

const TARGET: DeployTarget = {
  bucket: "blueprint-site-test",
  distributionId: "E1ABCDEFGHIJKL",
};

const KEYS = [
  "assets/index-BFQKd29Q.js",
  "assets/index-DiHHffOu.css",
  "content/club-photos.v1.json",
  "content/index.json",
  "favicon.svg",
  "icons/s3.svg",
  "index.html",
];

let root: string;
let siteDir: string;

const writeSite = async (keys: readonly string[] = KEYS) => {
  for (const key of keys) {
    const file = path.join(siteDir, ...key.split("/"));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "x");
  }
};

/** A fake AWS CLI that records every call and answers the listing with `remote`. */
const fakeAws = (remote: string[] | null = [], fail?: (args: readonly string[]) => boolean) => {
  const calls: string[][] = [];
  const run = (args: readonly string[]): Promise<AwsResult> => {
    calls.push([...args]);
    if (fail?.(args) === true) {
      return Promise.resolve({ code: 254, stdout: "", stderr: "An error occurred (AccessDenied)" });
    }
    if (args[1] === "list-objects-v2") {
      return Promise.resolve({ code: 0, stdout: JSON.stringify(remote), stderr: "" });
    }
    if (args[1] === "create-invalidation") {
      return Promise.resolve({ code: 0, stdout: "I2ABCDEFGH\n", stderr: "" });
    }
    return Promise.resolve({ code: 0, stdout: "", stderr: "" });
  };
  return { run, calls };
};

const runDeploy = async (aws: ReturnType<typeof fakeAws>, dryRun = false) => {
  const lines: string[] = [];
  const result = await deploy({
    siteDir,
    target: TARGET,
    dryRun,
    run: aws.run,
    log: (line) => lines.push(line),
  });
  return { result, lines };
};

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "deploy-site-"));
  siteDir = path.join(root, "site");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("readTarget", () => {
  const env = {
    SITE_BUCKET: " blueprint-site-test ",
    SITE_DISTRIBUTION_ID: "E1ABCDEFGHIJKL",
    AWS_ACCESS_KEY_ID: "ASIAEXAMPLE",
  };

  it("reads bucket and distribution from the environment, with its credentials", () => {
    expect(readTarget(env, false)).toEqual(TARGET);
  });

  it("fails naming every missing or invalid variable", () => {
    expect(() => readTarget({}, false)).toThrow(DeployError);
    expect(() => readTarget({ SITE_BUCKET: "", AWS_ACCESS_KEY_ID: "  " }, false)).toThrow(
      /Falta SITE_BUCKET[\s\S]*Falta SITE_DISTRIBUTION_ID[\s\S]*Faltan las credenciales del entorno \(AWS_ACCESS_KEY_ID\)/,
    );
    expect(() => readTarget({ ...env, SITE_BUCKET: "s3://blueprint-site-test" }, false)).toThrow(
      "SITE_BUCKET tiene que ser el nombre del bucket",
    );
    expect(() =>
      readTarget({ ...env, SITE_DISTRIBUTION_ID: "d111111abcdef8.cloudfront.net" }, false),
    ).toThrow("SITE_DISTRIBUTION_ID tiene que ser el ID de la distribución");
  });

  it("with dry-run shows placeholders for what is missing, but still rejects invalid values", () => {
    expect(readTarget({}, true)).toEqual({
      bucket: "<SITE_BUCKET>",
      distributionId: "<SITE_DISTRIBUTION_ID>",
    });
    expect(readTarget(env, true)).toEqual(TARGET);
    // dry-run never contacts AWS: it needs no credentials.
    expect(readTarget({ ...env, AWS_ACCESS_KEY_ID: undefined }, true)).toEqual(TARGET);
    expect(() => readTarget({ SITE_BUCKET: "Not A Bucket" }, true)).toThrow(DeployError);
  });

  it("without credentials in the environment fails, never falls back to a profile or a default", () => {
    const noCredentials = { ...env, AWS_ACCESS_KEY_ID: undefined };
    expect(() => readTarget(noCredentials, false)).toThrow(
      "Faltan las credenciales del entorno (AWS_ACCESS_KEY_ID)",
    );
    expect(() => readTarget({ ...env, AWS_ACCESS_KEY_ID: " " }, false)).toThrow(
      "Faltan las credenciales del entorno",
    );
    // A profile is not a way in anymore, with or without credentials in the environment.
    expect(() => readTarget({ ...noCredentials, AWS_PROFILE: "admin" }, false)).toThrow(
      "Faltan las credenciales del entorno",
    );
    expect(readTarget({ ...env, AWS_PROFILE: "admin" }, false)).toEqual(TARGET);
    // The value of the key is never shown.
    expect(() => readTarget({ ...env, SITE_BUCKET: "" }, false)).toThrow(/^(?![\s\S]*ASIAEXAMPLE)/);
  });
});

describe("planUploads", () => {
  it("gives each file its headers and leaves the content bundle and index.html for the end", () => {
    const plan = planUploads(KEYS);
    expect(plan.map((item) => item.key)).toEqual([
      "assets/index-BFQKd29Q.js",
      "assets/index-DiHHffOu.css",
      "favicon.svg",
      "icons/s3.svg",
      "content/club-photos.v1.json",
      "content/index.json",
      "index.html",
    ]);
    expect(plan[0]).toEqual({
      key: "assets/index-BFQKd29Q.js",
      contentType: "text/javascript; charset=utf-8",
      cacheControl: "public, max-age=31536000, immutable",
    });
    expect(plan.at(-1)).toEqual({
      key: "index.html",
      contentType: "text/html; charset=utf-8",
      cacheControl: "no-cache",
    });
  });
});

describe("staleKeys", () => {
  it("lists what the bucket has and the site no longer does", () => {
    expect(
      staleKeys(["index.html", "assets/index-OLDOLDOL.js", "content/old.v1.json"], KEYS),
    ).toEqual(["assets/index-OLDOLDOL.js", "content/old.v1.json"]);
    expect(staleKeys([], KEYS)).toEqual([]);
  });
});

describe("AWS CLI arguments", () => {
  it("uploads one file with its Content-Type and Cache-Control", () => {
    const [item] = planUploads(["assets/index-BFQKd29Q.js"]);
    expect(uploadArgs(item!, siteDir, TARGET)).toEqual([
      "s3",
      "cp",
      path.join(siteDir, "assets", "index-BFQKd29Q.js"),
      "s3://blueprint-site-test/assets/index-BFQKd29Q.js",
      "--content-type",
      "text/javascript; charset=utf-8",
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--only-show-errors",
    ]);
  });

  it("lists, removes and invalidates", () => {
    expect(listArgs(TARGET)).toEqual([
      "s3api",
      "list-objects-v2",
      "--bucket",
      "blueprint-site-test",
      "--query",
      "Contents[].Key",
      "--output",
      "json",
    ]);
    expect(removeArgs("assets/index-OLDOLDOL.js", TARGET)).toEqual([
      "s3",
      "rm",
      "s3://blueprint-site-test/assets/index-OLDOLDOL.js",
      "--only-show-errors",
    ]);
    // Only what keeps its name between deploys: never the whole distribution.
    expect(INVALIDATION_PATHS).toEqual(["/index.html", "/content/*"]);
    expect(invalidationArgs(TARGET)).toEqual([
      "cloudfront",
      "create-invalidation",
      "--distribution-id",
      "E1ABCDEFGHIJKL",
      "--paths",
      "/index.html",
      "/content/*",
      "--query",
      "Invalidation.Id",
      "--output",
      "text",
    ]);
  });

  it("never passes --profile: the credentials come from the environment", () => {
    for (const args of [
      uploadArgs(planUploads(["index.html"])[0]!, siteDir, TARGET),
      listArgs(TARGET),
      removeArgs("index.html", TARGET),
      invalidationArgs(TARGET),
    ]) {
      expect(args).not.toContain("--profile");
    }
  });
});

describe("deploy", () => {
  it("uploads everything, index.html last, removes stale objects and invalidates", async () => {
    await writeSite();
    const aws = fakeAws([...KEYS, "assets/index-OLDOLDOL.js"]);
    const { result, lines } = await runDeploy(aws);

    const commands = aws.calls.map((args) => `${args[0]} ${args[1]}`);
    expect(commands).toEqual([
      ...KEYS.map(() => "s3 cp"),
      "s3api list-objects-v2",
      "s3 rm",
      "cloudfront create-invalidation",
    ]);
    const uploads = aws.calls.filter((args) => args[1] === "cp");
    expect(uploads.at(-1)?.[3]).toBe("s3://blueprint-site-test/index.html");
    expect(aws.calls.find((args) => args[1] === "rm")?.[2]).toBe(
      "s3://blueprint-site-test/assets/index-OLDOLDOL.js",
    );
    expect(result).toEqual({
      uploaded: planUploads(KEYS).map((item) => item.key),
      deleted: ["assets/index-OLDOLDOL.js"],
      invalidationId: "I2ABCDEFGH",
    });
    expect(lines).toContain("Invalidación I2ABCDEFGH creada para /index.html y /content/*.");
  });

  it("deletes nothing on an empty bucket (the CLI answers null)", async () => {
    await writeSite();
    const aws = fakeAws(null);
    const { result, lines } = await runDeploy(aws);
    expect(result.deleted).toEqual([]);
    expect(aws.calls.some((args) => args[1] === "rm")).toBe(false);
    expect(lines).toContain("Nada para borrar: el bucket no tiene archivos de más.");
  });

  it("with dry-run prints every command and runs none", async () => {
    await writeSite();
    const aws = fakeAws();
    const { result, lines } = await runDeploy(aws, true);

    expect(aws.calls).toEqual([]);
    expect(result.invalidationId).toBeUndefined();
    expect(result.uploaded).toHaveLength(KEYS.length);
    const text = lines.join("\n");
    expect(text).toContain("Modo --dry-run: no se ejecuta ningún comando ni se contacta a AWS.");
    expect(text).toContain(
      's3://blueprint-site-test/index.html --content-type "text/html; charset=utf-8" --cache-control no-cache',
    );
    expect(text).toContain(
      '--cache-control "public, max-age=31536000, immutable" --only-show-errors',
    );
    expect(text).toContain("aws s3api list-objects-v2 --bucket blueprint-site-test");
    expect(text).toContain(
      'aws cloudfront create-invalidation --distribution-id E1ABCDEFGHIJKL --paths /index.html "/content/*"',
    );
    // index.html is the last upload shown.
    const cps = lines.filter((line) => line.includes("aws s3 cp"));
    expect(cps.at(-1)).toContain("s3://blueprint-site-test/index.html");
  });

  it("stops before index.html, the deletions and the invalidation when an upload fails", async () => {
    await writeSite();
    const aws = fakeAws([], (args) => args[1] === "cp" && args[3]!.endsWith("/icons/s3.svg"));
    await expect(runDeploy(aws)).rejects.toThrow(
      /Falló la subida de icons\/s3\.svg:[\s\S]*An error occurred \(AccessDenied\)/,
    );
    const commands = aws.calls.map((args) => args.join(" "));
    expect(commands.some((command) => command.includes("/index.html"))).toBe(false);
    expect(commands.some((command) => command.includes("list-objects-v2"))).toBe(false);
    expect(commands.some((command) => command.includes("create-invalidation"))).toBe(false);
  });

  it("does not delete anything when the listing is not what it expects", async () => {
    await writeSite();
    const aws = fakeAws();
    const run = (args: readonly string[]) =>
      args[1] === "list-objects-v2"
        ? Promise.resolve({ code: 0, stdout: "not json", stderr: "" })
        : aws.run(args);
    await expect(
      deploy({ siteDir, target: TARGET, dryRun: false, run, log: () => undefined }),
    ).rejects.toThrow("El listado del bucket no tiene el formato esperado");
    expect(aws.calls.some((args) => args[1] === "rm")).toBe(false);
  });

  it("refuses a directory that is not a built site", async () => {
    const aws = fakeAws();
    await expect(runDeploy(aws)).rejects.toThrow("Corré pnpm build:site antes de pnpm deploy:site");
    await writeSite(["index.html"]);
    await expect(runDeploy(aws)).rejects.toThrow("Falta content/index.json");
    expect(aws.calls).toEqual([]);
  });

  it("refuses a file without a known Content-Type before uploading anything", async () => {
    await writeSite([...KEYS, "video.mp4"]);
    const aws = fakeAws();
    await expect(runDeploy(aws)).rejects.toThrow(
      'No hay un Content-Type definido para "video.mp4"',
    );
    expect(aws.calls).toEqual([]);
  });

  it("refuses a site built with the fake login of the e2e tests (ADR-0029)", async () => {
    await writeSite();
    const asset = KEYS.find((key) => key.endsWith(".js")) ?? "assets/index.js";
    await writeFile(
      path.join(siteDir, ...asset.split("/")),
      `console.warn("${FAKE_AUTH_MARKER}: fake login");`,
    );
    const aws = fakeAws();
    await expect(runDeploy(aws)).rejects.toThrow("tiene el login falso de los e2e");
    expect(aws.calls).toEqual([]);
  });

  it("looks for the marker that the fake login of the web carries", async () => {
    const fake = await readFile(
      path.join(REPO_ROOT, "apps", "web", "src", "auth", "fake-session.ts"),
      "utf8",
    );
    expect(fake).toContain(`"${FAKE_AUTH_MARKER}"`);
  });
});
