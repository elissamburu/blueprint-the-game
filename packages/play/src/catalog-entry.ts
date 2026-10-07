// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// How a catalog entry (service or concept) is shown on a card: its icon and its names. Which name
// a card shows is presentation, not evaluation (ADR-0027 §6), so it lives here and not in
// game-engine. At level 0 a card shows the plain name first and the real name below it (RF-PAL-06);
// at any other level it shows the name, as always.
import type { ConceptGlyph, EntryType, Service } from "@blueprint/scenario-schema";
import { doubleName } from "@blueprint/ui/components/service-name";

/** The fields of a catalog entry a card needs. A missing `type` means a service. */
export type CardEntry = Pick<Service, "id" | "name" | "category"> & {
  readonly type?: EntryType | undefined;
  readonly plainName?: string | undefined;
  readonly glyph?: ConceptGlyph | undefined;
};

/** Level 0 cards show the plain name first (RF-PAL-06). */
export const showsPlainNames = (level: number): boolean => level === 0;

/**
 * Icon of an entry. A concept has no official icon (ADR-0027 §1): it never asks the app for
 * icons/<id>.svg; it shows its glyph or, without one, its initials.
 */
export const entryIcon = (
  entry: CardEntry,
  iconSrc: (serviceId: string) => string | undefined,
): { src?: string | undefined; glyph?: ConceptGlyph | undefined } =>
  entry.type === "concept" ? { glyph: entry.glyph } : { src: iconSrc(entry.id) };

/** The plain name the card shows, or undefined when it shows only the name. */
export const cardPlainName = (
  entry: Pick<CardEntry, "plainName">,
  plainNames: boolean,
): string | undefined => (plainNames ? entry.plainName : undefined);

/**
 * Accessible name of a card: the name, or «<plainName> (<name>)» when it shows the plain name,
 * e.g. «Almacenamiento de archivos (Amazon S3)».
 */
export const cardAccessibleName = (
  entry: Pick<CardEntry, "name" | "plainName">,
  plainNames: boolean,
): string => {
  const plainName = cardPlainName(entry, plainNames);
  return plainName === undefined ? entry.name : doubleName(plainName, entry.name);
};
