// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// pnpm icons:fetch (RF-CAT-05, ADR-0012): downloads the pinned package (or reuses the cached
// copy), verifies its SHA-256 before decompressing, and writes one <serviceId>.svg per mapped
// catalog service. The icons are copied unmodified and never committed.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatIssues, parseServices } from "@blueprint/scenario-schema";
import { unzipSync } from "fflate";
import { parse as parseYaml } from "yaml";
import { IconsFetchError, parseIconsConfig } from "./config.js";
import { sha256Hex, verifySha256 } from "./hash.js";
import { resolveIcons, type IconResolution } from "./mapping.js";

export interface FetchIconsPaths {
  configFile: string;
  catalogFile: string;
  outDir: string;
  /** The zip is cached here as <sha256>.zip (CI caches this directory by hash). */
  cacheDir: string;
}

export const defaultPaths = (repoRoot: string): FetchIconsPaths => ({
  configFile: path.join(repoRoot, "tools", "icons-fetch", "icons.config.json"),
  catalogFile: path.join(repoRoot, "content", "catalog", "services.yaml"),
  outDir: path.join(repoRoot, "apps", "web", "public", "icons"),
  cacheDir: path.join(repoRoot, ".cache", "aws-icons"),
});

export interface FetchIconsOptions extends FetchIconsPaths {
  fetch: (url: string) => Promise<Pick<Response, "ok" | "status" | "statusText" | "arrayBuffer">>;
  log: (line: string) => void;
  /** How paths are shown in messages. */
  show: (file: string) => string;
}

export interface FetchIconsResult {
  release: string;
  resolution: IconResolution;
  /** False when a mapping points to a missing or ambiguous file: nothing was written. */
  written: boolean;
}

const readIfExists = async (file: string): Promise<Uint8Array | undefined> => {
  try {
    return await readFile(file);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return undefined;
    throw error;
  }
};

const download = async (url: string, options: FetchIconsOptions): Promise<Uint8Array> => {
  let response: Awaited<ReturnType<FetchIconsOptions["fetch"]>>;
  try {
    response = await options.fetch(url);
  } catch (error) {
    throw new IconsFetchError(`No se pudo descargar ${url}: ${(error as Error).message}`);
  }
  if (!response.ok) {
    throw new IconsFetchError(
      `No se pudo descargar ${url}: HTTP ${response.status} ${response.statusText}`.trimEnd(),
    );
  }
  return new Uint8Array(await response.arrayBuffer());
};

/** Cached zip when its hash still matches; otherwise a verified download (then cached). */
const loadPackage = async (
  url: string,
  sha256: string,
  options: FetchIconsOptions,
): Promise<Uint8Array> => {
  const cacheFile = path.join(options.cacheDir, `${sha256}.zip`);
  const cached = await readIfExists(cacheFile);
  if (cached !== undefined) {
    if (sha256Hex(cached) === sha256) {
      options.log(`Usando el paquete en caché (${options.show(cacheFile)}).`);
      return cached;
    }
    options.log(`El paquete en caché está corrupto; se descarga de nuevo.`);
    await rm(cacheFile, { force: true });
  }
  options.log(`Descargando ${url}`);
  const data = await download(url, options);
  verifySha256(data, sha256, options.show(options.configFile));
  await mkdir(options.cacheDir, { recursive: true });
  await writeFile(cacheFile, data);
  return data;
};

const unzip = (data: Uint8Array, keep: (name: string) => boolean): Record<string, Uint8Array> => {
  try {
    return unzipSync(data, { filter: (file) => keep(file.name) });
  } catch (error) {
    throw new IconsFetchError(
      `El paquete de íconos no es un zip válido: ${(error as Error).message}`,
    );
  }
};

const readCatalog = async (options: FetchIconsOptions) => {
  const file = options.show(options.catalogFile);
  let raw: unknown;
  try {
    raw = parseYaml(await readFile(options.catalogFile, "utf8"));
  } catch (error) {
    throw new IconsFetchError(`No se pudo leer ${file}: ${(error as Error).message}`);
  }
  const result = parseServices(raw);
  if (!result.success) {
    throw new IconsFetchError(
      `${file} no es válido (corré pnpm content:validate):\n${formatIssues(result.issues)}`,
    );
  }
  return result.data;
};

export const fetchIcons = async (options: FetchIconsOptions): Promise<FetchIconsResult> => {
  const config = parseIconsConfig(
    await readFile(options.configFile, "utf8"),
    options.show(options.configFile),
  );
  const services = await readCatalog(options);
  const data = await loadPackage(config.url, config.sha256, options);

  // First pass lists the entries without decompressing anything.
  const entries: string[] = [];
  unzip(data, (name) => {
    entries.push(name);
    return false;
  });
  const resolution = resolveIcons(services, entries);
  if (resolution.missing.length > 0 || resolution.ambiguous.length > 0) {
    return { release: config.release, resolution, written: false };
  }

  const wanted = new Set(resolution.resolved.map((icon) => icon.entry));
  const files = unzip(data, (name) => wanted.has(name));
  await rm(options.outDir, { recursive: true, force: true });
  await mkdir(options.outDir, { recursive: true });
  for (const { id, entry } of resolution.resolved) {
    const content = files[entry];
    if (content === undefined)
      throw new IconsFetchError(`Falta ${entry} al descomprimir el paquete`);
    await writeFile(path.join(options.outDir, `${id}.svg`), content);
  }
  return { release: config.release, resolution, written: true };
};
