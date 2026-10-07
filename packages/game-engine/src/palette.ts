// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Palette of a scenario by resolved mode (RF-PAL-01, RF-PAL-05, docs/01 "Modos de paleta"). It
// lives in @blueprint/scenario-schema, shared with the lint (L016, L022), and is re-exported here
// so the apps keep getting it from the engine.
export {
  buildPalette,
  type PaletteContent,
  type ScenarioPalette,
} from "@blueprint/scenario-schema";
