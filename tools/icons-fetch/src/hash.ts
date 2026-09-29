// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createHash } from "node:crypto";
import { IconsFetchError } from "./config.js";

export const sha256Hex = (data: Uint8Array): string =>
  createHash("sha256").update(data).digest("hex");

/**
 * Throws IconsFetchError unless `data` hashes to `expected`. Runs before anything in the
 * package is decompressed.
 */
export const verifySha256 = (data: Uint8Array, expected: string, configFile: string): void => {
  const actual = sha256Hex(data);
  if (actual === expected.toLowerCase()) return;
  throw new IconsFetchError(
    [
      `El SHA-256 del paquete de íconos no coincide con ${configFile}; no se descomprime nada.`,
      `  esperado: ${expected}`,
      `  obtenido: ${actual}`,
      "Si AWS publicó un paquete nuevo, actualizá url y sha256 desde https://aws.amazon.com/architecture/icons/.",
    ].join("\n"),
  );
};
