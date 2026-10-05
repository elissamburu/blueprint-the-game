// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Presentation of the palette built by game-engine (RF-PAL-02): its services grouped by
// category, in the order of categories.yaml, filtered by name and aliases. Which services are
// in the palette is decided by `buildPalette`, not here.
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

/** Case- and accent-insensitive match against the name, the full name and the aliases. */
export const matchesQuery = (
  service: Pick<Service, "name" | "fullName" | "aliases">,
  query: string,
): boolean => {
  const needle = normalize(query);
  if (needle === "") return true;
  return [service.name, service.fullName ?? "", ...service.aliases].some((text) =>
    normalize(text).includes(needle),
  );
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
): PaletteGroup[] => {
  const services = serviceIds.flatMap((id) => {
    const service = catalog.get(id);
    return service !== undefined && matchesQuery(service, query) ? [service] : [];
  });
  return categories.flatMap((category) => {
    const inCategory = services.filter((s) => s.category === category.id);
    return inCategory.length === 0 ? [] : [{ category, services: inCategory }];
  });
};
