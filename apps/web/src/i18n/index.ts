// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UI strings (ADR-0017): every text comes from locales/<lang>.json; es is the default and, in
// v1, the only language. Scenario content is not translated here (one language per scenario).
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "./locales/es.json";

export const defaultNS = "translation";
export const resources = { es: { translation: es } } as const;

void i18n.use(initReactI18next).init({
  lng: "es",
  fallbackLng: "es",
  defaultNS,
  resources,
  // Resources are bundled: initialize synchronously so the first render already has texts.
  initAsync: false,
  // React escapes the output.
  interpolation: { escapeValue: false },
});

export { i18n };
