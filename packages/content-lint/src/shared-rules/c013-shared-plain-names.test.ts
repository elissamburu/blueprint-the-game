// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c013, plainNameKey } from "./c013-shared-plain-names.js";

describe("C013 plainName shared between entries", () => {
  it("passes when every plainName belongs to a single entry", () => {
    expect(runSharedRule(c013)).toEqual([]);
    expect(
      runSharedRule(c013, (input) => {
        input.catalog[0]!.plainName = "Almacenamiento de archivos";
      }),
    ).toEqual([]);
  });

  it("compares ignoring case, accents and repeated blanks", () => {
    expect(plainNameKey("  Región   del MUNDO ")).toBe("region del mundo");
    expect(plainNameKey("Pingüino")).toBe(plainNameKey("pinguino"));
  });

  it("warns for the same plainName, with other case and accents, in another entry", () => {
    const issues = runSharedRule(c013, (input) => {
      input.catalog[0]!.plainName = "Lúgar del MUNDO";
    });
    expect(issues).toEqual([
      {
        code: "C013",
        severity: "warning",
        message:
          'El plainName "Lugar del mundo" de "region" ya lo usa "s3": en el nivel 0 las dos tarjetas se verían con el mismo nombre; usá nombres simples distintos.',
        path: ["catalog", 9, "plainName"],
      },
    ]);
  });
});
