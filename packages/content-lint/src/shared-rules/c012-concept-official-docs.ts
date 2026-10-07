// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { OFFICIAL_DOC_HOSTS, isOfficialReference } from "@blueprint/scenario-schema";
import type { Issue, SharedRule } from "../types.js";

/** `docs` of a concept is its official source (ADR-0027 §1): same hosts as L011. */
export const c012: SharedRule = {
  code: "C012",
  description: "El docs de un concepto apunta a documentación oficial de AWS.",
  check: ({ catalog }) =>
    catalog.flatMap((entry, i): Issue[] =>
      entry.type !== "concept" || isOfficialReference(entry.docs)
        ? []
        : [
            {
              code: "C012",
              severity: "error",
              message: `El docs del concepto "${entry.id}" (${entry.docs}) no es documentación oficial: un concepto se explica con una fuente oficial en ${OFFICIAL_DOC_HOSTS.join(" o ")}.`,
              path: ["catalog", i, "docs"],
            },
          ],
    ),
};
