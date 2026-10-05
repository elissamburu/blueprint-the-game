// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UI strings of the Studio (ADR-0017), in the `studio` namespace. The game screen of the preview
// brings its texts in the `play` namespace of @blueprint/play (ADR-0025).
import playEs from "@blueprint/play/locales/es.json";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import studioEs from "../locales/es.json";

export const defaultNS = "studio";
export const resources = { es: { studio: studioEs, play: playEs } } as const;

void i18n.use(initReactI18next).init({
  lng: "es",
  fallbackLng: "es",
  defaultNS,
  ns: [defaultNS, "play"],
  resources,
  // Resources are bundled: initialize synchronously so the first render already has texts.
  initAsync: false,
  // React escapes the output.
  interpolation: { escapeValue: false },
});

export { i18n };
