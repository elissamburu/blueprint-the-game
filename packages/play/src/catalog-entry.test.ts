// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it, vi } from "vitest";
import { cardAccessibleName, cardPlainName, entryIcon, showsPlainNames } from "./catalog-entry";

const s3 = { id: "s3", name: "Amazon S3", category: "storage", plainName: "Almacenamiento" };
const region = {
  id: "region",
  type: "concept" as const,
  name: "Región de AWS",
  category: "concept-global-infrastructure",
  glyph: "region" as const,
};

describe("showsPlainNames", () => {
  it.each([
    [0, true],
    [100, false],
    [400, false],
  ])("level %i → %s", (level, shows) => {
    expect(showsPlainNames(level)).toBe(shows);
  });
});

describe("cardAccessibleName", () => {
  it("is «plain name (name)» at level 0, the name otherwise or without a plain name", () => {
    expect(cardAccessibleName(s3, true)).toBe("Almacenamiento (Amazon S3)");
    expect(cardAccessibleName(s3, false)).toBe("Amazon S3");
    expect(cardAccessibleName(region, true)).toBe("Región de AWS");
    expect(cardPlainName(s3, false)).toBeUndefined();
  });
});

describe("entryIcon", () => {
  it("asks the app for a service icon and never for a concept's", () => {
    const iconSrc = vi.fn((id: string) => `/icons/${id}.svg`);
    expect(entryIcon(s3, iconSrc)).toEqual({ src: "/icons/s3.svg" });
    expect(entryIcon(region, iconSrc)).toEqual({ glyph: "region" });
    expect(entryIcon({ ...region, glyph: undefined }, iconSrc)).toEqual({ glyph: undefined });
    expect(iconSrc).toHaveBeenCalledOnce();
  });
});
