// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { NODE_SIZE, type Group } from "@blueprint/scenario-schema";
import { describe, expect, it } from "vitest";
import { nodeById, runRule } from "../testing/fixtures.js";
import { contains, l007, overlaps } from "./l007-layout.js";

const group = (id: string, rect: Group["rect"], parent: string | null = "cloud"): Group => ({
  id,
  kind: "generic",
  label: id,
  rect,
  parent,
});

describe("L007 layout", () => {
  it("passes for the base layout", () => {
    expect(runRule(l007)).toEqual([]);
  });

  it("uses NODE_SIZE with position as the top-left corner", () => {
    const width = NODE_SIZE.actor.w;
    expect(
      runRule(l007, (scenario) => {
        nodeById(scenario, "member").position = { x: 1200 - width, y: 620 };
      }),
    ).toEqual([]);
    const issues = runRule(l007, (scenario) => {
      nodeById(scenario, "member").position = { x: 1201 - width, y: 620 };
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "error",
        message: 'El nodo "member" (caja de 120×80 en 1081,620) se sale del canvas (1200×700).',
        path: ["diagram", "nodes", 0, "position"],
      },
    ]);
  });

  it("fails for a node outside its group", () => {
    const issues = runRule(l007, (scenario) => {
      nodeById(scenario, "logs").position = { x: 1030, y: 480 };
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "error",
        message:
          'El nodo "logs" (caja de 160×80 en 1030,480) no está completamente dentro del rect de su grupo "cloud".',
        path: ["diagram", "nodes", 3, "position"],
      },
    ]);
  });

  it("fails for overlapping nodes of any type", () => {
    const slots = runRule(l007, (scenario) => {
      nodeById(scenario, "thumbnailer").position = { x: 400, y: 150 };
    });
    expect(slots.map((issue) => issue.message)).toEqual([
      'El nodo "thumbnailer" se superpone con el nodo "store".',
    ]);
    const others = runRule(l007, (scenario) => {
      nodeById(scenario, "member").position = { x: 950, y: 520 };
      nodeById(scenario, "member").group = "cloud";
    });
    expect(others.map((issue) => [issue.severity, issue.message])).toEqual([
      ["error", 'El nodo "logs" se superpone con el nodo "member".'],
    ]);
  });

  it("does not treat touching borders as an overlap", () => {
    expect(
      runRule(l007, (scenario) => {
        nodeById(scenario, "thumbnailer").position = { x: 300 + NODE_SIZE.slot.w, y: 120 };
      }),
    ).toEqual([]);
  });

  it("fails for a group outside the canvas", () => {
    const issues = runRule(l007, (scenario) => {
      scenario.diagram.groups[0]!.rect = { x: 200, y: 40, w: 1100, h: 620 };
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "error",
        message: 'El grupo "cloud" se sale del canvas (1200×700).',
        path: ["diagram", "groups", 0, "rect"],
      },
    ]);
  });

  it("checks that child groups lie inside their parent", () => {
    expect(
      runRule(l007, (scenario) => {
        scenario.diagram.groups.push(group("vpc", { x: 280, y: 100, w: 400, h: 200 }));
        nodeById(scenario, "store").group = "vpc";
      }),
    ).toEqual([]);
    const issues = runRule(l007, (scenario) => {
      scenario.diagram.groups.push(group("vpc", { x: 100, y: 100, w: 400, h: 200 }));
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "error",
        message: 'El grupo "vpc" no está completamente dentro del rect de su grupo padre "cloud".',
        path: ["diagram", "groups", 1, "rect"],
      },
    ]);
  });

  it("warns for overlapping sibling groups only", () => {
    const issues = runRule(l007, (scenario) => {
      scenario.diagram.groups.push(
        group("subnet-a", { x: 220, y: 300, w: 300, h: 150 }),
        group("subnet-b", { x: 500, y: 300, w: 300, h: 150 }),
      );
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "warning",
        message:
          'El grupo "subnet-b" se superpone con su grupo hermano "subnet-a". Si no es intencional (p. ej. un grupo transversal), separalos.',
        path: ["diagram", "groups", 2, "rect"],
      },
    ]);
  });

  it("warns for a node drawn inside a group without belonging to it", () => {
    const issues = runRule(l007, (scenario) => {
      scenario.diagram.groups.push(group("vpc", { x: 250, y: 60, w: 600, h: 300 }));
      delete nodeById(scenario, "store").group;
    });
    expect(issues).toEqual([
      {
        code: "L007",
        severity: "warning",
        message:
          'El nodo "store" se dibuja dentro del grupo "vpc" pero no tiene group: ¿falta group: vpc?',
        path: ["diagram", "nodes", 1],
      },
    ]);
  });

  it("skips groups that do not exist (reported by L018)", () => {
    expect(
      runRule(l007, (scenario) => {
        nodeById(scenario, "store").group = "ghost";
        scenario.diagram.groups[0]!.parent = "ghost";
      }),
    ).toEqual([]);
  });

  it("exposes the box helpers", () => {
    const box = { x: 0, y: 0, w: 10, h: 10 };
    expect(contains(box, { x: 0, y: 0, w: 10, h: 10 })).toBe(true);
    expect(contains(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(false);
    expect(overlaps(box, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(overlaps(box, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
});
