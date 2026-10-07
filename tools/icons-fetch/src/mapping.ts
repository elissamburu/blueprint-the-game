// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Resolves the `icon` field of the catalog against the entries of the official package (pure).
//
// Package layout (release 07312026):
//   Architecture-Service-Icons_<release>/Arch_<Category>/48/Arch_<Service>_48.svg
//   Resource-Icons_<release>/Res_<Category>/Res_<Resource>_48.svg
// plus __MACOSX/ metadata copies, which are ignored.

export interface ServiceIconRef {
  id: string;
  /** Concepts have no official icon (ADR-0027 §1): they are skipped, never `unmapped`. */
  type?: "service" | "concept" | undefined;
  icon?: string | undefined;
}

export interface ResolvedIcon {
  id: string;
  icon: string;
  /** Entry name inside the zip. */
  entry: string;
}

export interface IconResolution {
  resolved: ResolvedIcon[];
  /** Services without `icon`: the UI shows the category fallback. */
  unmapped: string[];
  /** `icon` values with no matching file in the package. */
  missing: { id: string; icon: string }[];
  /** `icon` values matching more than one file. */
  ambiguous: { id: string; icon: string; entries: string[] }[];
}

/** Top-level folder each icon prefix must live in. */
const FOLDER_BY_PREFIX: Record<string, string> = {
  Arch_: "Architecture-Service-Icons_",
  Res_: "Resource-Icons_",
};

const iconKey = (entry: string): string | undefined => {
  if (entry.startsWith("__MACOSX/") || !entry.endsWith(".svg")) return undefined;
  const parts = entry.split("/");
  const base = (parts.at(-1) ?? "").slice(0, -".svg".length);
  const prefix = Object.keys(FOLDER_BY_PREFIX).find((candidate) => base.startsWith(candidate));
  if (prefix === undefined || !(parts[0] ?? "").startsWith(FOLDER_BY_PREFIX[prefix] ?? "")) {
    return undefined;
  }
  return base;
};

/** Index of icon base name → zip entries, for Arch_ and Res_ SVGs in their own folders. */
export const indexIcons = (entries: Iterable<string>): Map<string, string[]> => {
  const index = new Map<string, string[]>();
  for (const entry of entries) {
    const key = iconKey(entry);
    if (key === undefined) continue;
    index.set(key, [...(index.get(key) ?? []), entry]);
  }
  return index;
};

export const resolveIcons = (
  services: readonly ServiceIconRef[],
  entries: Iterable<string>,
): IconResolution => {
  const index = indexIcons(entries);
  const resolution: IconResolution = { resolved: [], unmapped: [], missing: [], ambiguous: [] };
  for (const { id, type, icon } of services) {
    if (type === "concept") continue;
    if (icon === undefined) {
      resolution.unmapped.push(id);
      continue;
    }
    const matches = index.get(icon) ?? [];
    const [entry] = matches;
    if (entry === undefined) resolution.missing.push({ id, icon });
    else if (matches.length > 1)
      resolution.ambiguous.push({ id, icon, entries: [...matches].sort() });
    else resolution.resolved.push({ id, icon, entry });
  }
  return resolution;
};
