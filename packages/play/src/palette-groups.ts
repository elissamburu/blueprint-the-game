// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Presentation of the palette built by game-engine (RF-PAL-02): its services grouped by
// category, in the order of categories.yaml, filtered by name and aliases (and, at level 0, by the
// plain name the cards show). Which services are in the palette is decided by `buildPalette`, not
// here.
import type { Category, Service } from "@blueprint/scenario-schema";

export interface PaletteGroup {
  readonly category: Pick<Category, "id" | "name">;
  readonly services: readonly Service[];
}

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * Case- and accent-insensitive match against the name, the full name and the aliases; with
 * `plainNames` (level 0, RF-PAL-06), against the plain name too.
 */
export const matchesQuery = (
  service: Pick<Service, "name" | "fullName" | "aliases" | "plainName">,
  query: string,
  plainNames = false,
): boolean => {
  const needle = normalize(query);
  if (needle === "") return true;
  return [
    service.name,
    service.fullName ?? "",
    plainNames ? (service.plainName ?? "") : "",
    ...service.aliases,
  ].some((text) => normalize(text).includes(needle));
};

/**
 * Groups the palette services by category. Services keep the palette order inside each group;
 * empty groups are left out. Ids missing from the catalog are skipped.
 */
export const groupPalette = (
  serviceIds: readonly string[],
  catalog: ReadonlyMap<string, Service>,
  categories: readonly Pick<Category, "id" | "name">[],
  query = "",
  plainNames = false,
): PaletteGroup[] => {
  const services = serviceIds.flatMap((id) => {
    const service = catalog.get(id);
    return service !== undefined && matchesQuery(service, query, plainNames) ? [service] : [];
  });
  return categories.flatMap((category) => {
    const inCategory = services.filter((s) => s.category === category.id);
    return inCategory.length === 0 ? [] : [{ category, services: inCategory }];
  });
};
