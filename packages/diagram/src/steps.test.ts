// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { parseScenario, type Edge } from "@blueprint/scenario-schema";
import { parse as parseYaml } from "yaml";
import { describe, expect, it } from "vitest";
import { fakeServices, realScenarios, staticWebsiteScenario } from "./testing/fixtures";
import { describeRoute, describeStep, diagramSteps, edgeSteps, flowSteps } from "./steps";

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

describe("edgeSteps", () => {
  const actor = (id: string, label: string) =>
    ({ id, type: "actor", icon: "user", label, position: { x: 0, y: 0 } }) as const;

  it("gives each edge its step, label, description and route, in diagram order", () => {
    const steps = edgeSteps(staticWebsiteScenario.diagram, fakeServices);
    expect(steps.map((s) => s.edgeId)).toEqual(
      staticWebsiteScenario.diagram.edges.map((e) => e.id),
    );
    const dns = staticWebsiteScenario.diagram.nodes.find((n) => n.id === "dns");
    if (dns?.type !== "slot") throw new Error("no dns slot");
    const second = steps.find((s) => s.step === 2);
    expect(second?.name).toBe(`Paso 2: ${second?.label}`);
    expect(second?.route).toEqual({ from: "Visitantes", to: dns.role.replace(/\.$/, "") });
    // A slot is named by its role, never by its hidden service.
    expect(JSON.stringify(steps)).not.toContain("route53");
  });

  it("names every button differently, adding the route only when two would repeat", () => {
    const steps = edgeSteps(
      {
        nodes: [actor("a", "Cliente"), actor("b", "Zona A"), actor("c", "Zona B")],
        edges: [
          { id: "e1", from: "a", to: "b", step: 1, label: "Pide", style: "sync" },
          { id: "e2", from: "a", to: "c", step: 1, label: "Pide", style: "sync" },
          {
            id: "e3",
            from: "b",
            to: "c",
            step: 2,
            label: "Copia",
            style: "async",
            description: "Cada hora.",
          },
        ],
      },
      fakeServices,
    );
    expect(steps.map((s) => s.name)).toEqual([
      "Paso 1: Pide (Cliente → Zona A)",
      "Paso 1: Pide (Cliente → Zona B)",
      "Paso 2: Copia",
    ]);
    expect(steps[2]?.description).toBe("Cada hora.");
    expect(steps[0]?.description).toBeUndefined();
  });

  it("tells apart nodes that share a name by their group, and numbers what still repeats", () => {
    const fixed = (id: string, group: string) =>
      ({ id, type: "fixed", service: "ecs", group, position: { x: 0, y: 0 } }) as const;
    const group = (id: string, label: string) =>
      ({ id, kind: "subnet-private", label, rect: { x: 0, y: 0, w: 10, h: 10 } }) as const;
    const steps = edgeSteps(
      {
        groups: [group("sa", "Subred A"), group("sb", "Subred B")],
        nodes: [fixed("a", "sa"), fixed("b", "sb"), actor("x", "Destino")],
        edges: [
          { id: "e1", from: "a", to: "x", step: 1, label: "Pide", style: "sync" },
          { id: "e2", from: "b", to: "x", step: 1, label: "Pide", style: "sync" },
          { id: "e3", from: "x", to: "a", step: 2, label: "Va", style: "sync" },
          { id: "e4", from: "x", to: "a", step: 2, label: "Va", style: "sync" },
        ],
      },
      fakeServices,
    );
    expect(steps.map((s) => s.name)).toEqual([
      "Paso 1: Pide (Servicio ecs (Subred A) → Destino)",
      "Paso 1: Pide (Servicio ecs (Subred B) → Destino)",
      "Paso 2: Va (Destino → Servicio ecs (Subred A)) (1 de 2)",
      "Paso 2: Va (Destino → Servicio ecs (Subred A)) (2 de 2)",
    ]);
  });

  it("has unique names on every scenario of content/", () => {
    const sources = import.meta.glob("../../../content/scenarios/*/scenario.yaml", {
      query: "?raw",
      import: "default",
      eager: true,
    });
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(realScenarios.length);
    for (const [path, raw] of Object.entries(sources)) {
      const parsed = parseScenario(parseYaml(raw));
      if (!parsed.success) throw new Error(`${path}: ${JSON.stringify(parsed.issues)}`);
      const names = edgeSteps(parsed.data.diagram, fakeServices).map((s) => s.name);
      expect(new Set(names).size, path).toBe(names.length);
    }
  });
});
