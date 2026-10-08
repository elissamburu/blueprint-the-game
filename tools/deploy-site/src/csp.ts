// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Content-Security-Policy of the site (RNF-10, #44). Its only source is
// cloudfront/content-security-policy.txt, one directive per line: the response headers policy of
// infra/modules/static-site reads it with Terraform and the preview server with loadCsp. Both
// join the lines the same way (trimmed, blank lines dropped, "; " between directives), so the
// browser gets the very same header from both.
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

/**
 * The header value of a policy file. Fails on what the policy must never have: 'unsafe-eval',
 * 'unsafe-inline' for scripts, a report endpoint (there is none) or a malformed directive.
 */
export const parseCsp = (text: string): string => {
  const directives = text
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

export const loadCsp = async (file = CSP_FILE): Promise<string> =>
  parseCsp(await readFile(file, "utf8"));
