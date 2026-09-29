// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Edge } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { fakeServices, staticWebsiteScenario } from "./testing/fixtures";
import { describeRoute, describeStep, diagramSteps, flowSteps } from "./steps";

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
      {
        step: 1,
        edgeIds: ["e1", "e2"],
        labels: ["Pide sus secretos"],
        descriptions: [],
        routes: [],
      },
      {
        step: 2,
        edgeIds: ["e3", "e4"],
        labels: ["Llega por la red privada", "Registra"],
        descriptions: ["Solo errores."],
        routes: [],
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

describe("diagramSteps", () => {
  it("names routes by actor label, fixed service and slot role, never by a hidden service", () => {
    const steps = diagramSteps(staticWebsiteScenario.diagram, fakeServices);
    const dns = staticWebsiteScenario.diagram.nodes.find((n) => n.id === "dns");
    if (dns?.type !== "slot") throw new Error("no dns slot");
    const second = steps.find((s) => s.step === 2);
    expect(second?.routes).toEqual([{ from: "Visitantes", to: dns.role.replace(/\.$/, "") }]);
    expect(describeRoute(second!.routes[0]!)).toBe(`Visitantes → ${dns.role.replace(/\.$/, "")}`);
    const text = JSON.stringify(steps);
    expect(text).not.toContain("route53");
  });

  it("lists a route once when parallel edges repeat it", () => {
    const steps = flowSteps(
      [
        { id: "a", from: "x", to: "y", step: 1, label: "L", style: "sync" },
        { id: "b", from: "x", to: "y", step: 1, label: "L", style: "sync" },
      ],
      (id) => id.toUpperCase(),
    );
    expect(steps[0]?.routes).toEqual([{ from: "X", to: "Y" }]);
  });
});
