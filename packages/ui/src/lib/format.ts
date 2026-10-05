// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Numbers of the UI: one locale for all of them. "es-AR" and not "es": with "es", Intl groups
// thousands only from five digits on ("1840" but "45.000").
export const NUMBER_LOCALE = "es-AR";

const numbers = new Intl.NumberFormat(NUMBER_LOCALE);

/** 1840 → "1.840", 45000 → "45.000", 1.5 → "1,5". */
export const formatNumber = (value: number): string => numbers.format(value);
