// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Rule } from "../types.js";

export const l001: Rule = {
  code: "L001",
  description: "El id del escenario coincide con el nombre de su carpeta.",
  check: ({ scenario, folderName }) =>
    scenario.id === folderName
      ? []
      : [
          {
            code: "L001",
            severity: "error",
            message: `El id "${scenario.id}" no coincide con el nombre de la carpeta "${folderName}": tienen que ser iguales.`,
            path: ["id"],
          },
        ],
};
