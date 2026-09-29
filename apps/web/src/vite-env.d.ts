// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Repository the "Reportar un problema" link opens issues in (https://github.com/<owner>/<repo>).
   * Forks set it to their own; without it, the official repository.
   */
  readonly VITE_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
