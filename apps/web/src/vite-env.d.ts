// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Repository the "Reportar un problema" link opens issues in (https://github.com/<owner>/<repo>).
   * Forks set it to their own; without it, the official repository.
   */
  readonly VITE_REPO_URL?: string;
  /**
   * Where "Contanos qué te pareció" of the beta notice goes (an https URL, e.g. an external form).
   * Without it, the feedback-beta.yml issue form of the repository.
   */
  readonly VITE_FEEDBACK_URL?: string;
  /**
   * Login and profile (ADR-0029): the outputs of infra/envs/prod (deploy.yml passes them). All six
   * or none; without them the game stays in guest mode (src/auth/config.ts).
   */
  readonly VITE_AUTH_REGION?: string;
  readonly VITE_AUTH_USER_POOL_ID?: string;
  readonly VITE_AUTH_CLIENT_ID?: string;
  readonly VITE_AUTH_IDENTITY_POOL_ID?: string;
  readonly VITE_AUTH_DOMAIN?: string;
  readonly VITE_AUTH_TABLE?: string;
  /** "true" when the user pool has sign-in with Google (output auth_google_enabled). */
  readonly VITE_AUTH_GOOGLE?: string;
  /** "true" only in `vite build --mode e2e` (.env.e2e): the fake login of the e2e tests. */
  readonly VITE_AUTH_FAKE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * True only in `vite build --mode e2e` with VITE_AUTH_FAKE=true (vite.config.ts, plugin
 * blueprint-fake-auth): the fake login of the e2e tests. A literal at build time.
 */
declare const __BLUEPRINT_FAKE_AUTH__: boolean;
