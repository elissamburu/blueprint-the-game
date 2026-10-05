// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { genericExplanation } from "./generic-explanation";
import { i18n } from "./testing/i18n";

const t = i18n.getFixedT("es", "play");

describe("genericExplanation", () => {
  it("joins the catalog description and the slot role", () => {
    expect(
      genericExplanation(
        t,
        {
          short: "Ejecuta código en respuesta a eventos sin administrar servidores; cobra por uso.",
        },
        "Distribuir el contenido estático cerca de los visitantes",
      ),
    ).toBe(
      "Ejecuta código en respuesta a eventos sin administrar servidores; cobra por uso. No cumple el rol: Distribuir el contenido estático cerca de los visitantes",
    );
  });

  it("adds the period when the description has none", () => {
    expect(genericExplanation(t, { short: "Colas de mensajes" }, "Guardar archivos")).toBe(
      "Colas de mensajes. No cumple el rol: Guardar archivos",
    );
  });
});
