// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { CONCEPT_GLYPHS } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { CONCEPT_GLYPH_ICONS } from "./concept-glyphs";

describe("CONCEPT_GLYPH_ICONS", () => {
  it("maps exactly the glyphs of the schema enum", () => {
    expect(Object.keys(CONCEPT_GLYPH_ICONS).sort()).toEqual([...CONCEPT_GLYPHS].sort());
  });

  it("uses a different icon for each glyph", () => {
    expect(new Set(Object.values(CONCEPT_GLYPH_ICONS)).size).toBe(CONCEPT_GLYPHS.length);
  });
});
