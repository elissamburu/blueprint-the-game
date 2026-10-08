// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deploy,
  DeployError,
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

const TARGET: DeployTarget = {
  bucket: "blueprint-beta-site",
  distributionId: "E1ABCDEFGHIJKL",
  profile: "beta-admin",
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
  root = await mkdtemp(path.join(os.tmpdir(), "deploy-beta-"));
  siteDir = path.join(root, "beta-site");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("readTarget", () => {
  const env = {
    BETA_BUCKET: " blueprint-beta-site ",
    BETA_DISTRIBUTION_ID: "E1ABCDEFGHIJKL",
    AWS_PROFILE: "beta-admin",
  };

  it("reads bucket, distribution and profile from the environment", () => {
    expect(readTarget(env, false)).toEqual(TARGET);
  });

  it("fails naming every missing or invalid variable", () => {
    expect(() => readTarget({}, false)).toThrow(DeployError);
    expect(() => readTarget({ BETA_BUCKET: "", AWS_PROFILE: "  " }, false)).toThrow(
      /Falta BETA_BUCKET[\s\S]*Falta BETA_DISTRIBUTION_ID[\s\S]*Falta AWS_PROFILE/,
    );
    expect(() => readTarget({ ...env, BETA_BUCKET: "s3://blueprint-beta-site" }, false)).toThrow(
      "BETA_BUCKET tiene que ser el nombre del bucket",
    );
    expect(() =>
      readTarget({ ...env, BETA_DISTRIBUTION_ID: "d111111abcdef8.cloudfront.net" }, false),
    ).toThrow("BETA_DISTRIBUTION_ID tiene que ser el ID de la distribución");
  });

  it("with dry-run shows placeholders for what is missing, but still rejects invalid values", () => {
    expect(readTarget({}, true)).toEqual({
      bucket: "<BETA_BUCKET>",
      distributionId: "<BETA_DISTRIBUTION_ID>",
      profile: "<AWS_PROFILE>",
    });
    expect(readTarget(env, true)).toEqual(TARGET);
    expect(() => readTarget({ BETA_BUCKET: "Not A Bucket" }, true)).toThrow(DeployError);
  });

  it("without a profile uses the credentials of the environment (deploy.yml), never a default", () => {
    const ci = {
      BETA_BUCKET: "blueprint-beta-site",
      BETA_DISTRIBUTION_ID: "E1ABCDEFGHIJKL",
      AWS_ACCESS_KEY_ID: "ASIAEXAMPLE",
    };
    expect(readTarget(ci, false)).toEqual({ ...TARGET, profile: undefined });
    expect(readTarget(ci, true)).toEqual({ ...TARGET, profile: undefined });
    expect(() => readTarget({ ...ci, AWS_ACCESS_KEY_ID: " " }, false)).toThrow("Falta AWS_PROFILE");
    // An explicit profile still wins over credentials in the environment.
    expect(readTarget({ ...ci, AWS_PROFILE: "beta-admin" }, false)).toEqual(TARGET);
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
      "s3://blueprint-beta-site/assets/index-BFQKd29Q.js",
      "--content-type",
      "text/javascript; charset=utf-8",
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--only-show-errors",
      "--profile",
      "beta-admin",
    ]);
  });

  it("lists, removes and invalidates with the profile", () => {
    expect(listArgs(TARGET)).toEqual([
      "s3api",
      "list-objects-v2",
      "--bucket",
      "blueprint-beta-site",
      "--query",
      "Contents[].Key",
      "--output",
      "json",
      "--profile",
      "beta-admin",
    ]);
    expect(removeArgs("assets/index-OLDOLDOL.js", TARGET)).toEqual([
      "s3",
      "rm",
      "s3://blueprint-beta-site/assets/index-OLDOLDOL.js",
      "--only-show-errors",
      "--profile",
      "beta-admin",
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
      "--profile",
      "beta-admin",
    ]);
  });

  it("passes no --profile when the credentials come from the environment", () => {
    const ci = { ...TARGET, profile: undefined };
    for (const args of [
      uploadArgs(planUploads(["index.html"])[0]!, siteDir, ci),
      listArgs(ci),
      removeArgs("index.html", ci),
      invalidationArgs(ci),
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
    expect(uploads.at(-1)?.[3]).toBe("s3://blueprint-beta-site/index.html");
    expect(aws.calls.find((args) => args[1] === "rm")?.[2]).toBe(
      "s3://blueprint-beta-site/assets/index-OLDOLDOL.js",
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
      's3://blueprint-beta-site/index.html --content-type "text/html; charset=utf-8" --cache-control no-cache',
    );
    expect(text).toContain(
      '--cache-control "public, max-age=31536000, immutable" --only-show-errors --profile beta-admin',
    );
    expect(text).toContain("aws s3api list-objects-v2 --bucket blueprint-beta-site");
    expect(text).toContain(
      'aws cloudfront create-invalidation --distribution-id E1ABCDEFGHIJKL --paths /index.html "/content/*"',
    );
    // index.html is the last upload shown.
    const cps = lines.filter((line) => line.includes("aws s3 cp"));
    expect(cps.at(-1)).toContain("s3://blueprint-beta-site/index.html");
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
    await expect(runDeploy(aws)).rejects.toThrow("Corré pnpm build:beta antes de pnpm deploy:beta");
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
});
