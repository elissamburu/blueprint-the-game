// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Typed keys: t("unknown.key") is a type error.
import "i18next";
import type { defaultNS, resources } from "./index";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: (typeof resources)["es"];
  }
}
