// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

/** Indexes of the items whose `id` already appeared earlier in the list, in order. */
export const repeatedIdIndexes = (items: readonly { id: string }[]): number[] => {
  const seen = new Set<string>();
  return items.flatMap((item, i) => {
    const repeated = seen.has(item.id);
    seen.add(item.id);
    return repeated ? [i] : [];
  });
};
