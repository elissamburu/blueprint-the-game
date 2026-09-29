// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A tiny zip with the official package layout, for tests (never the real package).
import { strToU8, zipSync } from "fflate";

export const svg = (label: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><title>${label}</title></svg>`;

export const PACKAGE_ENTRIES: Record<string, string> = {
  "Architecture-Service-Icons_07312026/Arch_Compute/48/Arch_AWS-Lambda_48.svg": svg("lambda-48"),
  "Architecture-Service-Icons_07312026/Arch_Compute/64/Arch_AWS-Lambda_64.svg": svg("lambda-64"),
  "Architecture-Service-Icons_07312026/Arch_Storage/48/Arch_Amazon-Simple-Storage-Service_48.svg":
    svg("s3-48"),
  "Resource-Icons_07312026/Res_Networking-Content-Delivery/Res_Amazon-VPC_NAT-Gateway_48.svg":
    svg("nat-48"),
  "Resource-Icons_07312026/Res_General-Icons/Res_48_Dark/Res_Server_48_Dark.svg":
    svg("server-dark"),
  "Category-Icons_07312026/Arch-Category_48/Arch-Category_Compute_48.svg": svg("category"),
  "__MACOSX/Architecture-Service-Icons_07312026/Arch_Compute/48/._Arch_AWS-Lambda_48.svg": "junk",
};

export const packageZip = (entries: Record<string, string> = PACKAGE_ENTRIES): Uint8Array =>
  zipSync(
    Object.fromEntries(Object.entries(entries).map(([name, content]) => [name, strToU8(content)])),
    { mtime: new Date("2026-07-31T00:00:00Z") },
  );
