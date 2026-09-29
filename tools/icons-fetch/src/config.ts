// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Pinned download of the official AWS Architecture Icons package (icons.config.json, ADR-0012).
import * as z from "zod";

export const SHA256_HEX = /^[0-9a-f]{64}$/;

export const IconsConfigSchema = z.strictObject({
  $comment: z.string().optional(),
  release: z
    .string()
    .regex(/^\d{8}$/, { error: "release tiene que ser la fecha MMDDAAAA del paquete" }),
  url: z.url({ protocol: /^https$/, error: "url tiene que ser una URL https" }),
  sha256: z.string().regex(SHA256_HEX, {
    error: "sha256 tiene que ser el hash en hexadecimal (64 caracteres en minúscula)",
  }),
});

export type IconsConfig = z.infer<typeof IconsConfigSchema>;

export class IconsFetchError extends Error {
  override name = "IconsFetchError";
}

/** Parses the JSON text of icons.config.json; throws IconsFetchError with every issue. */
export const parseIconsConfig = (text: string, file: string): IconsConfig => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new IconsFetchError(`${file}: JSON inválido (${(error as Error).message})`);
  }
  const result = IconsConfigSchema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `  ${issue.path.join(".") || "(raíz)"}: ${issue.message}`,
    );
    throw new IconsFetchError(`${file} no es válido:\n${issues.join("\n")}`);
  }
  return result.data;
};
