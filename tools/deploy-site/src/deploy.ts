// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// pnpm deploy:site: uploads dist/site to the bucket of the site with the AWS CLI and invalidates
// CloudFront. The deploy job of deploy.yml runs it with the OIDC credentials of gh-deploy-content
// in the environment: there is no AWS CLI profile. It only builds argument lists and runs `aws`
// without a shell, so it works the same on Windows, macOS and Linux. With dryRun nothing is run
// and AWS is never contacted.
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import * as z from "zod";
import { CACHE_CONTROL, headersFor, type ObjectHeaders } from "./headers.js";
import { listSiteFiles } from "./site-files.js";

/** A problem of the deploy the maintainer can fix: reported without a stack trace. */
export class DeployError extends Error {}

export interface DeployTarget {
  bucket: string;
  distributionId: string;
}

export const ENV = {
  bucket: "SITE_BUCKET",
  distributionId: "SITE_DISTRIBUTION_ID",
  /** Set by aws-actions/configure-aws-credentials in deploy.yml, with the session of the role. */
  accessKeyId: "AWS_ACCESS_KEY_ID",
} as const;

const TargetSchema = z.object({
  bucket: z.string({ error: `Falta ${ENV.bucket}` }).regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/, {
    error: `${ENV.bucket} tiene que ser el nombre del bucket (sin s3:// ni barras)`,
  }),
  distributionId: z.string({ error: `Falta ${ENV.distributionId}` }).regex(/^[A-Z0-9]+$/, {
    error: `${ENV.distributionId} tiene que ser el ID de la distribución (p. ej. E1ABCDEFGHIJKL), no su dominio ni su ARN`,
  }),
});

/** Only checks that it is set: its value is never parsed nor shown. */
const CredentialsSchema = z.string({
  error: `Faltan las credenciales del entorno (${ENV.accessKeyId})`,
});

const envValue = (env: NodeJS.ProcessEnv, name: string): string | undefined => {
  const value = env[name]?.trim();
  return value === undefined || value === "" ? undefined : value;
};

/**
 * Bucket and distribution from the environment. With `dryRun` a missing variable is shown as a
 * placeholder instead of failing, so the plan can be read without an AWS account. Otherwise the
 * credentials have to be in the environment (AWS_ACCESS_KEY_ID, as GitHub Actions leaves them
 * after assuming the role); without them it fails, so the AWS CLI never falls back to whatever
 * default credentials or profile the machine has.
 */
export const readTarget = (env: NodeJS.ProcessEnv, dryRun: boolean): DeployTarget => {
  const raw = {
    bucket: envValue(env, ENV.bucket),
    distributionId: envValue(env, ENV.distributionId),
  };
  if (dryRun) {
    const present = TargetSchema.partial().safeParse(raw);
    if (!present.success) throw new DeployError(formatTargetIssues(present.error));
    return {
      bucket: raw.bucket ?? `<${ENV.bucket}>`,
      distributionId: raw.distributionId ?? `<${ENV.distributionId}>`,
    };
  }
  const parsed = TargetSchema.extend({ credentials: CredentialsSchema }).safeParse({
    ...raw,
    credentials: envValue(env, ENV.accessKeyId),
  });
  if (!parsed.success) throw new DeployError(formatTargetIssues(parsed.error));
  return { bucket: parsed.data.bucket, distributionId: parsed.data.distributionId };
};

const formatTargetIssues = (error: z.ZodError): string =>
  [
    "Configuración del deploy incompleta o inválida:",
    ...error.issues.map((issue) => `  - ${issue.message}`),
    `Definí ${ENV.bucket} y ${ENV.distributionId} como variables de entorno, con las credenciales del rol en el entorno (${ENV.accessKeyId}).`,
  ].join("\n");

export interface UploadItem extends ObjectHeaders {
  key: string;
}

/**
 * Upload order: first what the current site does not reference yet (hashed assets, icons), then
 * the content bundle, and the app shell last, so a player never gets an index.html that points
 * to files that are not in the bucket yet.
 */
const uploadRank = (item: UploadItem): number => {
  if (item.contentType.startsWith("text/html")) return 2;
  return item.cacheControl === CACHE_CONTROL.revalidate ? 1 : 0;
};

export const planUploads = (keys: readonly string[]): UploadItem[] =>
  keys
    .map((key) => ({ key, ...headersFor(key) }))
    .sort((a, b) => uploadRank(a) - uploadRank(b) || a.key.localeCompare(b.key, "en"));

/** Keys in the bucket that the site no longer has. */
export const staleKeys = (remote: readonly string[], local: readonly string[]): string[] => {
  const keep = new Set(local);
  return remote.filter((key) => !keep.has(key)).sort((a, b) => a.localeCompare(b, "en"));
};

/** What CloudFront must fetch again: the files that keep their name between deploys. */
export const INVALIDATION_PATHS = ["/index.html", "/content/*"] as const;

export const uploadArgs = (item: UploadItem, siteDir: string, target: DeployTarget): string[] => [
  "s3",
  "cp",
  path.join(siteDir, ...item.key.split("/")),
  `s3://${target.bucket}/${item.key}`,
  "--content-type",
  item.contentType,
  "--cache-control",
  item.cacheControl,
  "--only-show-errors",
];

export const listArgs = (target: DeployTarget): string[] => [
  "s3api",
  "list-objects-v2",
  "--bucket",
  target.bucket,
  "--query",
  "Contents[].Key",
  "--output",
  "json",
];

export const removeArgs = (key: string, target: DeployTarget): string[] => [
  "s3",
  "rm",
  `s3://${target.bucket}/${key}`,
  "--only-show-errors",
];

export const invalidationArgs = (target: DeployTarget): string[] => [
  "cloudfront",
  "create-invalidation",
  "--distribution-id",
  target.distributionId,
  "--paths",
  ...INVALIDATION_PATHS,
  "--query",
  "Invalidation.Id",
  "--output",
  "text",
];

export interface AwsResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type AwsRunner = (args: readonly string[]) => Promise<AwsResult>;

/** Runs the AWS CLI without a shell: arguments are never re-parsed, so no quoting issues. */
export const runAwsCli: AwsRunner = (args) =>
  new Promise((resolve, reject) => {
    const child = spawn("aws", args, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString("utf8")));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString("utf8")));
    child.on("error", (error: NodeJS.ErrnoException) =>
      reject(
        error.code === "ENOENT"
          ? new DeployError(
              "No se encontró el AWS CLI: instalá AWS CLI v2 y verificá que `aws` esté en el PATH.",
            )
          : error,
      ),
    );
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });

const shown = (args: readonly string[]): string =>
  ["aws", ...args].map((arg) => (/[\s*;]/.test(arg) ? `"${arg}"` : arg)).join(" ");

const RemoteKeysSchema = z.array(z.string()).nullable();

export interface DeployOptions {
  siteDir: string;
  target: DeployTarget;
  dryRun: boolean;
  run: AwsRunner;
  log: (line: string) => void;
  /** Uploads and deletions in parallel. */
  concurrency?: number;
}

export interface DeployResult {
  uploaded: string[];
  deleted: string[];
  /** Id of the CloudFront invalidation; undefined with dryRun. */
  invalidationId?: string;
}

const inParallel = async <T>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> => {
  let next = 0;
  let failed = false;
  const worker = async () => {
    while (!failed && next < items.length) {
      const item = items[next++] as T;
      try {
        await task(item);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  // allSettled: every worker stops before the first error is reported.
  const results = await Promise.allSettled(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  const rejected = results.find((result) => result.status === "rejected");
  if (rejected !== undefined) throw rejected.reason;
};

/**
 * The fake login of the e2e tests (apps/web/src/auth/fake-session.ts) carries this marker. A
 * production build never has it (vite.config.ts fails a build with VITE_AUTH_FAKE outside
 * --mode e2e); this is the second barrier: the e2e build is never uploaded.
 */
export const FAKE_AUTH_MARKER = "blueprint-fake-auth:never-deploy";

export const refuseFakeAuth = async (siteDir: string, keys: readonly string[]): Promise<void> => {
  for (const key of keys.filter((k) => k.endsWith(".js") || k.endsWith(".html"))) {
    if ((await readFile(path.join(siteDir, key), "utf8")).includes(FAKE_AUTH_MARKER)) {
      throw new DeployError(
        `${key} tiene el login falso de los e2e (VITE_AUTH_FAKE): no se sube. Armá el sitio con pnpm build:site.`,
      );
    }
  }
};

export const deploy = async (options: DeployOptions): Promise<DeployResult> => {
  const { target, dryRun, run, log } = options;
  const siteDir = path.resolve(options.siteDir);
  const concurrency = options.concurrency ?? 6;

  const keys = await listSiteFiles(siteDir);
  for (const required of ["index.html", "content/index.json"]) {
    if (!keys.includes(required)) {
      throw new DeployError(
        `Falta ${required} en ${siteDir}. Corré pnpm build:site antes de pnpm deploy:site.`,
      );
    }
  }
  await refuseFakeAuth(siteDir, keys);
  const uploads = planUploads(keys);

  const aws = async (args: readonly string[], what: string): Promise<string> => {
    const result = await run(args);
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || `código ${result.code}`;
      throw new DeployError(`Falló ${what}:\n  ${shown(args)}\n  ${detail}`);
    }
    return result.stdout;
  };

  log(
    `Destino: s3://${target.bucket} · distribución ${target.distributionId} · credenciales del entorno`,
  );

  if (dryRun) {
    log("Modo --dry-run: no se ejecuta ningún comando ni se contacta a AWS.");
    log(`1. Subiría ${uploads.length} archivo/s, index.html al final:`);
    for (const item of uploads) log(`  ${shown(uploadArgs(item, siteDir, target))}`);
    log("2. Listaría el bucket y borraría cada objeto que ya no está en el sitio:");
    log(`  ${shown(listArgs(target))}`);
    log(`  ${shown(removeArgs("<objeto que sobra>", target))}`);
    log(`3. Crearía una invalidación de CloudFront de ${INVALIDATION_PATHS.join(" y ")}:`);
    log(`  ${shown(invalidationArgs(target))}`);
    return { uploaded: uploads.map((item) => item.key), deleted: [] };
  }

  const shell = uploads.filter((item) => uploadRank(item) === 2);
  const rest = uploads.filter((item) => uploadRank(item) !== 2);
  const upload = async (item: UploadItem) => {
    await aws(uploadArgs(item, siteDir, target), `la subida de ${item.key}`);
    log(`  subido   ${item.key}  (${item.contentType}; ${item.cacheControl})`);
  };
  log(`Subiendo ${uploads.length} archivo/s…`);
  await inParallel(rest, concurrency, upload);
  // The app shell goes last and alone: everything it references is already in the bucket.
  for (const item of shell) await upload(item);

  const listed = await aws(listArgs(target), "el listado del bucket");
  let remote: string[];
  try {
    remote = RemoteKeysSchema.parse(JSON.parse(listed.trim() === "" ? "null" : listed)) ?? [];
  } catch {
    throw new DeployError(`El listado del bucket no tiene el formato esperado:\n${listed}`);
  }
  const stale = staleKeys(remote, keys);
  log(
    stale.length === 0
      ? "Nada para borrar: el bucket no tiene archivos de más."
      : `Borrando ${stale.length} archivo/s que ya no existen…`,
  );
  await inParallel(stale, concurrency, async (key) => {
    await aws(removeArgs(key, target), `el borrado de ${key}`);
    log(`  borrado  ${key}`);
  });

  const invalidationId = (
    await aws(invalidationArgs(target), "la invalidación de CloudFront")
  ).trim();
  log(`Invalidación ${invalidationId} creada para ${INVALIDATION_PATHS.join(" y ")}.`);

  return { uploaded: uploads.map((item) => item.key), deleted: stale, invalidationId };
};
