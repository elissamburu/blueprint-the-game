// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins class names and resolves Tailwind conflicts (the later class wins). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
