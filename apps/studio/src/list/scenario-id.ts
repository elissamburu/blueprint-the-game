// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The id the "Nuevo escenario" dialog proposes from the title (RF-STU-01). Only a suggestion of
// the UI: the server still checks the id (S5) and answers 409 when it exists (S8).
import { KEBAB_CASE } from "@blueprint/scenario-schema";

export const ID_MIN_LENGTH = 3;
export const ID_MAX_LENGTH = 64;

/** Cuts a kebab-case id to `max` characters at a hyphen when there is one, never mid-word if it can. */
const cut = (id: string, max: number): string => {
  if (id.length <= max) return id;
  const head = id.slice(0, max);
  // The next character is a hyphen: the cut falls between two words.
  if (id[max] === "-") return head;
  const lastHyphen = head.lastIndexOf("-");
  return (lastHyphen > 0 ? head.slice(0, lastHyphen) : head).replace(/-+$/, "");
};

/**
 * The kebab-case form of a title: lower case, without accents nor other diacritics (NFD and the
 * marks removed, so "ñ" is "n"), every other run of characters a single hyphen, none at the ends,
 * at most 64 characters. `undefined` when nothing valid is left (only symbols, or under 3).
 */
export const slugFromTitle = (title: string, max = ID_MAX_LENGTH): string | undefined => {
  const slug = title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const id = cut(slug, max);
  return id.length >= ID_MIN_LENGTH && KEBAB_CASE.test(id) ? id : undefined;
};

/**
 * The id for a new scenario titled `title`: its slug, or the slug with -2, -3… when an existing
 * scenario already uses it. The suffix fits in the 64 characters by cutting the slug first.
 */
export const idFromTitle = (title: string, existing: readonly string[]): string | undefined => {
  const base = slugFromTitle(title);
  if (base === undefined) return undefined;
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const suffix = `-${n}`;
    const head = slugFromTitle(base, ID_MAX_LENGTH - suffix.length) ?? base;
    const id = `${head}${suffix}`;
    if (!taken.has(id)) return id;
  }
};

/** The title suggested when duplicating: "<title> (copia)", within the schema's maximum. */
export const copyTitle = (title: string, max: number): string => {
  const suffix = " (copia)";
  if (title.length + suffix.length <= max) return `${title}${suffix}`;
  return `${title.slice(0, max - suffix.length).trimEnd()}${suffix}`;
};
