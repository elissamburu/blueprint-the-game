// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "./cli.js";
import { defaultPaths } from "./fetch-icons.js";
import { sha256Hex } from "./hash.js";
import { packageZip, svg } from "./testing/package-zip.js";

const URL = "https://example.com/Icon-package_07312026.zip";

const service = (id: string, icon?: string) =>
  [
    `- id: ${id}`,
    `  name: Servicio ${id}`,
    "  category: compute",
    `  leakPatterns: ["${id}"]`,
    '  short: "Descripción."',
    "  docs: https://docs.aws.amazon.com/",
    ...(icon === undefined ? [] : [`  icon: ${icon}`]),
    "  status: active",
  ].join("\n");

const CATALOG = [
  service("lambda", "Arch_AWS-Lambda_48"),
  service("s3", "Arch_Amazon-Simple-Storage-Service_48"),
  service("nat-gateway", "Res_Amazon-VPC_NAT-Gateway_48"),
].join("\n");

let root: string;
let paths: ReturnType<typeof defaultPaths>;
const zip = packageZip();

const writeFixture = async ({ catalog = CATALOG, sha256 = sha256Hex(zip) } = {}) => {
  await mkdir(path.dirname(paths.configFile), { recursive: true });
  await mkdir(path.dirname(paths.catalogFile), { recursive: true });
  await writeFile(paths.configFile, JSON.stringify({ release: "07312026", url: URL, sha256 }));
  await writeFile(paths.catalogFile, catalog);
};

const okResponse = (data: Uint8Array) => ({
  ok: true,
  status: 200,
  statusText: "OK",
  arrayBuffer: () => Promise.resolve(data.slice().buffer),
});

const run = async (fetch = vi.fn(() => Promise.resolve(okResponse(zip)))) => {
  let stdout = "";
  let stderr = "";
  const code = await main(
    [],
    { stdout: (text) => (stdout += text), stderr: (text) => (stderr += text) },
    { repoRoot: root, fetch },
  );
  return { code, stdout, stderr, fetch };
};

const icons = async () => (await readdir(paths.outDir).catch(() => [])).sort();

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "icons-fetch-"));
  paths = defaultPaths(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("icons:fetch", () => {
  it("downloads, verifies and writes <serviceId>.svg unmodified", async () => {
    await writeFixture();
    const { code, stdout, stderr, fetch } = await run();

    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(fetch).toHaveBeenCalledWith(URL);
    expect(await icons()).toEqual(["lambda.svg", "nat-gateway.svg", "s3.svg"]);
    expect(await readFile(path.join(paths.outDir, "nat-gateway.svg"), "utf8")).toBe(svg("nat-48"));
    expect(stdout).toContain("3 ícono(s) del paquete 07312026 en apps/web/public/icons/.");
  });

  it("reuses the cached zip by hash without downloading", async () => {
    await writeFixture();
    await run();
    const { code, stdout, fetch } = await run();

    expect(code).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(stdout).toContain(
      `Usando el paquete en caché (.cache/aws-icons/${sha256Hex(zip)}.zip).`,
    );
  });

  it("downloads again when the cached zip is corrupt", async () => {
    await writeFixture();
    await mkdir(paths.cacheDir, { recursive: true });
    await writeFile(path.join(paths.cacheDir, `${sha256Hex(zip)}.zip`), "corrupt");
    const { code, stdout, fetch } = await run();

    expect(code).toBe(0);
    expect(fetch).toHaveBeenCalledOnce();
    expect(stdout).toContain("El paquete en caché está corrupto");
  });

  it("fails on a hash mismatch before decompressing or caching anything", async () => {
    await writeFixture({ sha256: "0".repeat(64) });
    const { code, stderr } = await run();

    expect(code).toBe(1);
    expect(stderr).toContain(
      "El SHA-256 del paquete de íconos no coincide con tools/icons-fetch/icons.config.json",
    );
    expect(stderr).toContain(`obtenido: ${sha256Hex(zip)}`);
    expect(await icons()).toEqual([]);
    expect(await readdir(paths.cacheDir).catch(() => [])).toEqual([]);
  });

  it("fails when a mapping points to a file that is not in the package, and writes nothing", async () => {
    await writeFixture({
      catalog: [CATALOG, service("typo", "Arch_AWS-Lamda_48"), service("new-service")].join("\n"),
    });
    const { code, stdout, stderr } = await run();

    expect(code).toBe(1);
    expect(stdout).toContain("1 servicio(s) del catálogo sin ícono mapeado");
    expect(stdout).toContain("  - new-service");
    expect(stderr).toContain("1 mapeo(s) apuntan a íconos que no existen en el paquete 07312026:");
    expect(stderr).toContain("  - typo: Arch_AWS-Lamda_48");
    expect(await icons()).toEqual([]);
  });

  it("reports services without icon but still succeeds", async () => {
    await writeFixture({ catalog: [CATALOG, service("new-service")].join("\n") });
    const { code, stdout } = await run();

    expect(code).toBe(0);
    expect(stdout).toContain("  - new-service");
    expect(await icons()).toEqual(["lambda.svg", "nat-gateway.svg", "s3.svg"]);
  });

  it("replaces icons from a previous run", async () => {
    await writeFixture();
    await mkdir(paths.outDir, { recursive: true });
    await writeFile(path.join(paths.outDir, "removed-service.svg"), "old");
    await run();

    expect(await icons()).toEqual(["lambda.svg", "nat-gateway.svg", "s3.svg"]);
  });

  it("fails with a clear message when the download fails", async () => {
    await writeFixture();
    const notFound = vi.fn(() =>
      Promise.resolve({ ...okResponse(zip), ok: false, status: 404, statusText: "Not Found" }),
    );
    const offline = vi.fn(() => Promise.reject(new Error("getaddrinfo ENOTFOUND")));

    expect((await run(notFound)).stderr).toBe(
      `Error: No se pudo descargar ${URL}: HTTP 404 Not Found\n`,
    );
    expect((await run(offline)).stderr).toBe(
      `Error: No se pudo descargar ${URL}: getaddrinfo ENOTFOUND\n`,
    );
  });

  it("fails when the config is invalid", async () => {
    await writeFixture({ sha256: "not-a-hash" });
    const { code, stderr } = await run();

    expect(code).toBe(1);
    expect(stderr).toContain("tools/icons-fetch/icons.config.json no es válido:");
    expect(stderr).toContain("sha256:");
  });

  it("fails when the catalog does not match the schema", async () => {
    await writeFixture({ catalog: service("lambda", "Arch_AWS-Lambda_48.svg") });
    const { code, stderr } = await run();

    expect(code).toBe(1);
    expect(stderr).toContain("content/catalog/services.yaml no es válido");
    expect(stderr).toContain("(lambda).icon");
  });

  it("fails when the downloaded file is not a zip", async () => {
    const notZip = new TextEncoder().encode("<html>not a zip</html>");
    await writeFixture({ sha256: sha256Hex(notZip) });
    const { code, stderr } = await run(vi.fn(() => Promise.resolve(okResponse(notZip))));

    expect(code).toBe(1);
    expect(stderr).toContain("El paquete de íconos no es un zip válido");
  });

  it("prints usage with --help and rejects unknown options", async () => {
    let stdout = "";
    let stderr = "";
    const io = {
      stdout: (text: string) => (stdout += text),
      stderr: (text: string) => (stderr += text),
    };

    expect(await main(["--help"], io)).toBe(0);
    expect(stdout).toContain("pnpm icons:fetch");
    expect(await main(["--nope"], io)).toBe(2);
    expect(stderr).toContain("--nope");
  });
});
