// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Configuration of the login (ADR-0029), from the build variables VITE_AUTH_*: the outputs of
// infra/envs/prod that deploy.yml passes to the build. Without them (local development, a fork
// without AWS) there is no login and the game stays in guest mode. Part of the initial bundle:
// nothing here loads oidc-client-ts or the AWS SDK.
import * as z from "zod";

/** Route of the web where the hosted UI returns (callback_urls of infra/modules/auth). */
export const CALLBACK_PATH = "/auth/callback";

/** Prefix of every key of the login in sessionStorage (never localStorage). */
export const SESSION_PREFIX = "blueprint.auth.";

export interface AuthConfig {
  readonly region: string;
  readonly userPoolId: string;
  readonly clientId: string;
  readonly identityPoolId: string;
  /** Host of the hosted UI: <prefix>.auth.<region>.amazoncognito.com. */
  readonly domain: string;
  /** The profiles table. */
  readonly table: string;
}

// Formats of the identifiers in the Cognito and DynamoDB API references (UserPoolId, ClientId,
// IdentityPoolId, TableName) and of the prefix domain.
const REGION = /^[a-z]{2}(?:-[a-z]+)+-\d{1,2}$/;
const AuthEnvSchema = z
  .object({
    VITE_AUTH_REGION: z.string().regex(REGION),
    VITE_AUTH_USER_POOL_ID: z.string().regex(/^[\w-]+_[0-9a-zA-Z]+$/),
    VITE_AUTH_CLIENT_ID: z.string().regex(/^[\w+]{1,128}$/),
    VITE_AUTH_IDENTITY_POOL_ID: z.string().regex(/^[\w-]+:[0-9a-f-]+$/),
    VITE_AUTH_DOMAIN: z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.auth\.[a-z0-9-]+\.amazoncognito\.com$/),
    VITE_AUTH_TABLE: z.string().regex(/^[a-zA-Z0-9_.-]{3,255}$/),
  })
  .refine(
    (env) =>
      env.VITE_AUTH_DOMAIN.endsWith(`.auth.${env.VITE_AUTH_REGION}.amazoncognito.com`) &&
      env.VITE_AUTH_USER_POOL_ID.startsWith(`${env.VITE_AUTH_REGION}_`) &&
      env.VITE_AUTH_IDENTITY_POOL_ID.startsWith(`${env.VITE_AUTH_REGION}:`),
    "the user pool, the identity pool and the domain must be of VITE_AUTH_REGION",
  );

const KEYS = [
  "VITE_AUTH_REGION",
  "VITE_AUTH_USER_POOL_ID",
  "VITE_AUTH_CLIENT_ID",
  "VITE_AUTH_IDENTITY_POOL_ID",
  "VITE_AUTH_DOMAIN",
  "VITE_AUTH_TABLE",
] as const;

/**
 * The configuration, or null without a login: none of the variables set, or some missing or
 * malformed (with a warning: a half-configured build plays as a guest instead of breaking).
 */
export const readAuthConfig = (
  env: Partial<Record<(typeof KEYS)[number], string>>,
  warn: (message: string) => void = (message) => console.warn(message),
): AuthConfig | null => {
  if (KEYS.every((key) => (env[key] ?? "") === "")) return null;
  const parsed = AuthEnvSchema.safeParse(env);
  if (!parsed.success) {
    warn(`Login disabled: invalid VITE_AUTH_* (${z.prettifyError(parsed.error)})`);
    return null;
  }
  const value = parsed.data;
  return {
    region: value.VITE_AUTH_REGION,
    userPoolId: value.VITE_AUTH_USER_POOL_ID,
    clientId: value.VITE_AUTH_CLIENT_ID,
    identityPoolId: value.VITE_AUTH_IDENTITY_POOL_ID,
    domain: value.VITE_AUTH_DOMAIN,
    table: value.VITE_AUTH_TABLE,
  };
};

export const authConfig = readAuthConfig(import.meta.env);

/**
 * The fake login and profile of the e2e tests (src/auth/fake-session.ts): only in a build with
 * --mode e2e (vite.config.ts fails otherwise).
 */
export const FAKE_AUTH = __BLUEPRINT_FAKE_AUTH__;

/**
 * "Continuar con Google" (ADR-0029): VITE_AUTH_GOOGLE comes from the output auth_google_enabled of
 * infra/envs/prod, true only when the user pool has the Google identity provider. Without a login
 * there is no button either.
 */
export const readGoogleSignIn = (enabled: boolean, value: string | undefined): boolean =>
  enabled && value === "true";

export const GOOGLE_SIGN_IN = readGoogleSignIn(
  authConfig !== null || FAKE_AUTH,
  import.meta.env.VITE_AUTH_GOOGLE,
);

/** Identity providers of the hosted UI besides the user pool's own users. */
export type IdentityProvider = "Google";

/** Whether this tab may have a session to restore (tokens of the login in sessionStorage). */
export const hasStoredSession = (storage: () => Storage = () => window.sessionStorage): boolean => {
  try {
    const store = storage();
    return Array.from({ length: store.length }, (_, i) => store.key(i)).some(
      (key) => key?.startsWith(SESSION_PREFIX) === true && key.includes("user"),
    );
  } catch {
    return false;
  }
};

/** A path of this site to return to after signing in (never another origin). */
export const safeReturnPath = (value: unknown): string =>
  typeof value === "string" && /^\/(?![/\\])\S*$/.test(value) && !value.startsWith(CALLBACK_PATH)
    ? value
    : "/";
