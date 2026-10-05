// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UI strings of the Studio (ADR-0017), in the `studio` namespace.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import studioEs from "../locales/es.json";

export const defaultNS = "studio";
export const resources = { es: { studio: studioEs } } as const;

void i18n.use(initReactI18next).init({
  lng: "es",
  fallbackLng: "es",
  defaultNS,
  ns: [defaultNS],
  resources,
  // Resources are bundled: initialize synchronously so the first render already has texts.
  initAsync: false,
  // React escapes the output.
  interpolation: { escapeValue: false },
});

export { i18n };
