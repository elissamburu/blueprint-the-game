// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Edge } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { describeStep, flowSteps } from "./steps";

const edge = (id: string, step: number, label: string, description?: string): Edge => ({
  id,
  from: "a",
  to: "b",
  step,
  label,
  style: "sync",
  ...(description === undefined ? {} : { description }),
});

describe("flowSteps", () => {
  it("groups parallel edges by step, in step order, without repeating labels", () => {
    const steps = flowSteps([
      edge("e3", 2, "Llega por la red privada"),
      edge("e1", 1, "Pide sus secretos"),
      edge("e2", 1, "Pide sus secretos"),
      edge("e4", 2, "Registra", "Solo errores."),
    ]);
    expect(steps).toEqual([
      { step: 1, edgeIds: ["e1", "e2"], labels: ["Pide sus secretos"], descriptions: [] },
      {
        step: 2,
        edgeIds: ["e3", "e4"],
        labels: ["Llega por la red privada", "Registra"],
        descriptions: ["Solo errores."],
      },
    ]);
  });
});

describe("describeStep", () => {
  it("reads the step, its labels and its description", () => {
    const [step] = flowSteps([edge("e1", 1, "Sube el PDF", "Directo al almacenamiento.")]);
    expect(describeStep(step!, 4)).toBe("Paso 1 de 4: Sube el PDF. Directo al almacenamiento.");
  });
});
