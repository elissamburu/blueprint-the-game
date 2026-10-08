// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Content-Security-Policy of the site (RNF-10, #44). Its only source is
// cloudfront/content-security-policy.txt, one directive per line: the response headers policy of
// infra/modules/static-site reads it with Terraform and the preview server with loadCsp. Both
// join the lines the same way (trimmed, blank lines dropped, "; " between directives), so the
// browser gets the very same header from both.
//
// The file is a template (ADR-0029): ${aws_region} and ${auth_domain} are the endpoints of the
// login and the profile. Terraform fills them with templatefile (the region of the site and the
// domain the auth module creates); renderCsp does the same substitution here, with the values the
// web is built with (VITE_AUTH_REGION and VITE_AUTH_DOMAIN).
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const CSP_FILE = fileURLToPath(
  new URL("../cloudfront/content-security-policy.txt", import.meta.url),
);

/**
 * Phase 1 of #44: the policy only reports (in the console), it blocks nothing. Phase 2 moves it
 * to Content-Security-Policy.
 */
export const CSP_HEADER = "Content-Security-Policy-Report-Only";

/**
 * Longest value CloudFront accepts in a custom header of a response headers policy (Quotas on
 * headers: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html#limits-custom-headers).
 */
export const CSP_MAX_LENGTH = 1783;

/** A policy file that breaks a rule of docs/adr/0028-content-security-policy.md. */
export class InvalidCspError extends Error {}

const DIRECTIVE = /^[a-z][a-z-]*(?: [^\s;,]+)*$/;

/** The values of the placeholders of the template, as Terraform names them. */
export interface CspValues {
  /** ${aws_region}: region of Cognito and DynamoDB, e.g. us-east-2. */
  readonly awsRegion: string;
  /** ${auth_domain}: <prefix>.auth.<region>.amazoncognito.com. */
  readonly authDomain: string;
}

const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/;
/** The pattern of the prefix in CreateUserPoolDomain (infra/modules/auth/variables.tf). */
const DOMAIN_PREFIX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Values for a local preview without a login (VITE_AUTH_* not set): a domain of the same shape
 * that nothing serves. The deploy never uses them: Terraform renders the policy of CloudFront.
 */
export const PREVIEW_CSP_VALUES: CspValues = {
  awsRegion: "us-east-2",
  authDomain: "blueprint-preview.auth.us-east-2.amazoncognito.com",
};

/** The values the web is built with, or the preview ones when the login is not configured. */
export const cspValuesFromEnv = (env: NodeJS.ProcessEnv): CspValues => {
  const awsRegion = env.VITE_AUTH_REGION ?? "";
  const authDomain = env.VITE_AUTH_DOMAIN ?? "";
  if (awsRegion === "" && authDomain === "") return PREVIEW_CSP_VALUES;
  if (awsRegion === "" || authDomain === "") {
    throw new InvalidCspError("Definí VITE_AUTH_REGION y VITE_AUTH_DOMAIN juntas, o ninguna.");
  }
  return { awsRegion, authDomain };
};

/**
 * Fills the placeholders of the template as templatefile does. Only ${aws_region} and
 * ${auth_domain} exist: any other placeholder or template directive fails, and so does a value
 * that is not a region or a Cognito prefix domain of that same region (never a wildcard).
 */
export const renderCsp = (template: string, values: CspValues): string => {
  if (!REGION.test(values.awsRegion)) {
    throw new InvalidCspError(`Región inválida para la CSP: "${values.awsRegion}".`);
  }
  const suffix = `.auth.${values.awsRegion}.amazoncognito.com`;
  const prefix = values.authDomain.endsWith(suffix)
    ? values.authDomain.slice(0, -suffix.length)
    : "";
  if (!DOMAIN_PREFIX.test(prefix)) {
    throw new InvalidCspError(
      `Dominio de Cognito inválido para la CSP: "${values.authDomain}" (se espera <prefijo>${suffix}).`,
    );
  }
  if (template.includes("%{")) {
    throw new InvalidCspError("La CSP no admite directivas de template (%{...}).");
  }
  const vars: Readonly<Record<string, string>> = {
    aws_region: values.awsRegion,
    auth_domain: values.authDomain,
  };
  return template.replace(/\$\{([^}]*)\}/g, (_, name: string) => {
    const value = vars[name];
    if (value === undefined) throw new InvalidCspError(`Variable desconocida en la CSP: ${name}.`);
    return value;
  });
};

/**
 * The header value of a policy template. Fails on what the policy must never have: 'unsafe-eval',
 * 'unsafe-inline' for scripts, a report endpoint (there is none) or a malformed directive.
 */
export const parseCsp = (template: string, values: CspValues): string => {
  const directives = renderCsp(template, values)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  const seen = new Set<string>();
  for (const directive of directives) {
    if (!DIRECTIVE.test(directive)) {
      throw new InvalidCspError(`Directiva mal formada en la CSP: "${directive}".`);
    }
    const [name = "", ...sources] = directive.split(" ");
    if (seen.has(name)) throw new InvalidCspError(`La CSP repite la directiva ${name}.`);
    seen.add(name);
    if (sources.includes("'unsafe-eval'")) {
      throw new InvalidCspError(`La CSP no puede tener 'unsafe-eval' (${name}).`);
    }
    if (name.startsWith("script-src") && sources.includes("'unsafe-inline'")) {
      throw new InvalidCspError(`La CSP no puede tener 'unsafe-inline' en ${name}.`);
    }
    if (name === "report-uri" || name === "report-to") {
      throw new InvalidCspError(`La CSP no tiene endpoint de reportes: sacá ${name}.`);
    }
  }
  for (const required of ["default-src", "script-src", "object-src", "frame-ancestors"]) {
    if (!seen.has(required)) throw new InvalidCspError(`Falta la directiva ${required}.`);
  }
  const value = directives.join("; ");
  if (value.length > CSP_MAX_LENGTH) {
    throw new InvalidCspError(
      `La CSP tiene ${value.length} caracteres; CloudFront acepta hasta ${CSP_MAX_LENGTH}.`,
    );
  }
  return value;
};

export const loadCsp = async (values: CspValues, file = CSP_FILE): Promise<string> =>
  parseCsp(await readFile(file, "utf8"), values);
