// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Typed keys inside the package: t("unknown.key") is a type error. Only the package's own
// typecheck sees this file; an app types the play namespace with its own resources.
import "i18next";
import type es from "./locales/es.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "play";
    resources: { play: typeof es };
  }
}
