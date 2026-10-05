// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { KEBAB_CASE, MAX_LENGTH } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { copyTitle, idFromTitle, slugFromTitle } from "./scenario-id";

describe("slugFromTitle", () => {
  it("drops accents and other diacritics, ñ included", () => {
    expect(slugFromTitle("Migración de la Base de Datos")).toBe("migracion-de-la-base-de-datos");
    expect(slugFromTitle("Diseño para el año próximo")).toBe("diseno-para-el-ano-proximo");
    expect(slugFromTitle("Pingüinos à la carte")).toBe("pinguinos-a-la-carte");
  });

  it("turns spaces and symbols into single hyphens, none at the ends", () => {
    expect(slugFromTitle("  ¿Colas   de pedidos? ¡Sí!  ")).toBe("colas-de-pedidos-si");
    expect(slugFromTitle("API REST + caché (v2) / S3")).toBe("api-rest-cache-v2-s3");
    expect(slugFromTitle("uno--dos__tres")).toBe("uno-dos-tres");
  });

  it("cuts at 64 characters without splitting a word", () => {
    const title =
      "Un sistema de procesamiento de comprobantes en PDF para un estudio contable grande";
    const id = slugFromTitle(title);
    expect(id).toBe("un-sistema-de-procesamiento-de-comprobantes-en-pdf-para-un");
    expect(id?.length).toBeLessThanOrEqual(64);
    // Exactly at a word boundary: nothing is lost.
    expect(slugFromTitle(`${"a".repeat(30)} ${"b".repeat(33)} c`)).toBe(
      `${"a".repeat(30)}-${"b".repeat(33)}`,
    );
  });

  it("cuts a single word longer than 64 characters", () => {
    expect(slugFromTitle("x".repeat(80))).toBe("x".repeat(64));
  });

  it("gives nothing when no valid id is left", () => {
    expect(slugFromTitle("¿¡!?…")).toBeUndefined();
    expect(slugFromTitle("")).toBeUndefined();
    expect(slugFromTitle("日本語")).toBeUndefined();
    // Valid characters, but under 3.
    expect(slugFromTitle("¡Ñ!")).toBeUndefined();
  });
});

describe("idFromTitle", () => {
  it("is the slug when it is free", () => {
    expect(idFromTitle("Sitio estático", ["otro"])).toBe("sitio-estatico");
  });

  it("adds -2, -3… when the id exists", () => {
    expect(idFromTitle("Sitio estático", ["sitio-estatico"])).toBe("sitio-estatico-2");
    expect(idFromTitle("Sitio estático", ["sitio-estatico", "sitio-estatico-2"])).toBe(
      "sitio-estatico-3",
    );
  });

  it("keeps the suffix within 64 characters", () => {
    // 63 characters: with "-2" the last word does not fit, so it goes.
    const title = `${"palabra ".repeat(7)}finales`;
    const base = idFromTitle(title, []);
    expect(base).toBe(`${"palabra-".repeat(7)}finales`);
    expect(base).toHaveLength(63);
    const next = idFromTitle(title, [base ?? ""]);
    expect(next).toBe(`${"palabra-".repeat(7)}2`);
    expect(next?.length).toBeLessThanOrEqual(64);
    const long = "y".repeat(64);
    expect(idFromTitle(long, [long])).toBe(`${"y".repeat(62)}-2`);
  });

  it("every id it gives is valid against the schema", () => {
    for (const title of ["Ñandú", "a b c d", "-- 123 --", "Título con ñ y ü", "x".repeat(70)]) {
      const id = idFromTitle(title, []);
      expect(id, title).toMatch(KEBAB_CASE);
      expect(id?.length).toBeGreaterThanOrEqual(3);
      expect(id?.length).toBeLessThanOrEqual(64);
    }
  });

  it("gives nothing for a title without valid characters", () => {
    expect(idFromTitle("¡¿?!", [])).toBeUndefined();
  });
});

describe("copyTitle", () => {
  it("adds (copia), within the maximum", () => {
    expect(copyTitle("Sitio estático", MAX_LENGTH.title)).toBe("Sitio estático (copia)");
    const copy = copyTitle("t".repeat(MAX_LENGTH.title), MAX_LENGTH.title);
    expect(copy).toHaveLength(MAX_LENGTH.title);
    expect(copy.endsWith(" (copia)")).toBe(true);
  });
});
