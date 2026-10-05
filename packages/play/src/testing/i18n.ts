// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// i18next for the package's tests, with the play namespace registered as an app does.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import es from "../locales/es.json";

void i18n.use(initReactI18next).init({
  lng: "es",
  fallbackLng: "es",
  defaultNS: "play",
  resources: { es: { play: es } },
  initAsync: false,
  interpolation: { escapeValue: false },
});

export { i18n };
