// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { IconsFetchError } from "./config.js";
import { sha256Hex, verifySha256 } from "./hash.js";
import { packageZip } from "./testing/package-zip.js";

describe("sha256Hex", () => {
  it("hashes bytes as lowercase hex", () => {
    // Known vector: SHA-256 of "abc".
    expect(sha256Hex(new TextEncoder().encode("abc"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("verifySha256", () => {
  const zip = packageZip();
  const expected = sha256Hex(zip);

  it("accepts the pinned hash, in any case", () => {
    expect(() => verifySha256(zip, expected, "icons.config.json")).not.toThrow();
    expect(() => verifySha256(zip, expected.toUpperCase(), "icons.config.json")).not.toThrow();
  });

  it("rejects a tampered zip with both hashes in the message", () => {
    const tampered = zip.slice();
    tampered[tampered.length - 1] = (tampered.at(-1) ?? 0) ^ 0xff;
    let error: unknown;
    try {
      verifySha256(tampered, expected, "tools/icons-fetch/icons.config.json");
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(IconsFetchError);
    const message = (error as Error).message;
    expect(message).toContain("no coincide con tools/icons-fetch/icons.config.json");
    expect(message).toContain(`esperado: ${expected}`);
    expect(message).toContain(`obtenido: ${sha256Hex(tampered)}`);
  });
});
