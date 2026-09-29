// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Diagram } from "./Diagram";
import { fakeServices, pdfScenario } from "./testing/fixtures";

// jsdom has no layout: the mocks React Flow documents for tests (reactflow.dev "Testing").
beforeAll(() => {
  class ResizeObserverMock {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      const contentRect = { width: 1200, height: 800 } as DOMRectReadOnly;
      this.callback([{ target, contentRect } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  }
  class DOMMatrixReadOnlyMock {
    m22: number;
    constructor(transform?: string) {
      const scale = /scale\(([\d.]+)\)/.exec(transform ?? "")?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("DOMMatrixReadOnly", DOMMatrixReadOnlyMock);
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      get(this: HTMLElement) {
        return parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      get(this: HTMLElement) {
        return parseFloat(this.style.width) || 1;
      },
    },
  });
});

afterEach(cleanup);

const slotIds = pdfScenario.diagram.nodes.filter((n) => n.type === "slot").map((n) => n.id);

const renderBoard = (props: Partial<Parameters<typeof Diagram>[0]> = {}) =>
  render(
    <div style={{ width: 1200, height: 800 }}>
      <Diagram diagram={pdfScenario.diagram} services={fakeServices} {...props} />
    </div>,
  );

const slotButtons = () =>
  screen.getAllByRole("button").filter((b) => b.dataset.slot === "architecture-slot-main");

describe("Diagram slots", () => {
  it("are reachable with Tab in diagram order and activate with Enter and Space", async () => {
    const user = userEvent.setup();
    const onSlotActivate = vi.fn();
    renderBoard({ onSlotActivate });

    screen.getByRole("button", { name: "Reproducir flujo" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(slotButtons()[0]);
    await user.keyboard("{Enter}");
    expect(onSlotActivate).toHaveBeenLastCalledWith(slotIds[0]);

    await user.tab();
    expect(document.activeElement).toBe(slotButtons()[1]);
    await user.keyboard(" ");
    expect(onSlotActivate).toHaveBeenLastCalledWith(slotIds[1]);
    expect(onSlotActivate).toHaveBeenCalledTimes(2);
  });

  it('are named "<rol>. <estado>[: <servicio>]" and expose the selection', () => {
    renderBoard({
      onSlotActivate: () => {},
      slots: { "api-entry": { grade: "optimal", serviceId: "apigateway", selected: true } },
    });
    const [first, second] = slotButtons();
    expect(first?.getAttribute("aria-label")).toBe(
      "Punto de entrada HTTPS que recibe los pedidos del navegador, valida el token y los pasa a la lógica. Óptimo: Servicio apigateway",
    );
    expect(first?.getAttribute("aria-pressed")).toBe("true");
    expect(second?.getAttribute("aria-label")).toMatch(/lógica breve.*\. Vacío$/i);
    expect(second?.getAttribute("aria-pressed")).toBe("false");
  });

  it("are not focusable on a read-only board", () => {
    renderBoard();
    expect(slotButtons()).toHaveLength(0);
    expect(document.querySelectorAll('[data-slot="architecture-slot"]')).toHaveLength(
      slotIds.length,
    );
  });
});

describe("Diagram text alternative", () => {
  it("describes the board with the step strip", () => {
    renderBoard();
    const board = screen.getByRole("group", { name: "Diagrama de la arquitectura" });
    const strip = screen.getByRole("list", { name: "Pasos del flujo" });
    expect(board.getAttribute("aria-describedby")).toBe(strip.id);
    const steps = new Set(pdfScenario.diagram.edges.map((e) => e.step));
    expect(within(strip).getAllByRole("listitem")).toHaveLength(steps.size);
    expect(strip.textContent).toContain("Paso 1: Pide subir un comprobante");
  });

  it("announces the current step while the flow plays", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Reproducir flujo" }));
    const strip = screen.getByRole("list", { name: "Pasos del flujo" });
    expect(within(strip).getAllByRole("listitem")[0]?.getAttribute("aria-current")).toBe("step");
    expect(document.querySelector("p[aria-live]")?.textContent).toBe(
      "Paso 1 de 9: Pide subir un comprobante.",
    );
    await user.click(screen.getByRole("button", { name: "Detener" }));
    expect(screen.getByRole("button", { name: "Reproducir flujo" })).toBeDefined();
  });
});

describe("Diagram slot hint action", () => {
  it("replaces the hint counter of the slots it returns content for", () => {
    renderBoard({
      slotHintAction: (slotId) =>
        slotId === slotIds[0] ? <button type="button">Pista de {slotId}</button> : undefined,
    });
    expect(screen.getByRole("button", { name: `Pista de ${slotIds[0]}` })).toBeTruthy();
    expect(screen.queryByRole("button", { name: `Pista de ${slotIds[1]}` })).toBeNull();
  });
});

describe("Diagram viewport stability", () => {
  const transform = () =>
    document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform ?? "";

  /** Waits for the opening view (React Flow calls onInit after a tick). */
  const opened = async () => {
    await waitFor(() => expect(transform()).toMatch(/scale\(/));
    const initial = transform();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(transform()).toBe(initial);
    return initial;
  };

  it("keeps zoom and position when slot states, callbacks and hint actions change", async () => {
    const props = { onSlotActivate: () => {}, onServiceDrop: () => {} };
    const { rerender } = render(
      <DndContext>
        <div style={{ width: 1200, height: 800 }}>
          <Diagram diagram={pdfScenario.diagram} services={fakeServices} {...props} />
        </div>
      </DndContext>,
    );
    const initial = await opened();
    for (const grade of ["optimal", "acceptable", "incorrect", "empty"] as const) {
      rerender(
        <DndContext>
          <div style={{ width: 1200, height: 800 }}>
            <Diagram
              diagram={pdfScenario.diagram}
              services={fakeServices}
              slots={{ "api-entry": { grade, serviceId: grade === "empty" ? null : "apigateway" } }}
              onSlotActivate={() => {}}
              onServiceDrop={() => {}}
              slotHintAction={() => <button type="button">Pista</button>}
            />
          </div>
        </DndContext>,
      );
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(transform()).toBe(initial);
    }
  });

  it("does not pan when a slot gets focus by pointer or by script", async () => {
    renderBoard({ onSlotActivate: () => {} });
    const initial = await opened();
    // The app focuses a slot back after placing a service.
    slotButtons().at(-1)?.focus();
    // A click (pointerdown only: d3-zoom breaks on jsdom mouse events) and its focus.
    const clicked = slotButtons()[3];
    if (clicked === undefined) throw new Error("no slot");
    fireEvent.pointerDown(clicked);
    clicked.focus();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(transform()).toBe(initial);
  });

  it("pans to a slot out of view reached with Tab", async () => {
    const user = userEvent.setup();
    renderBoard({ onSlotActivate: () => {} });
    const initial = await opened();
    screen.getByRole("button", { name: "Reproducir flujo" }).focus();
    await user.tab();
    // jsdom has no layout: the board measures 0 × 0, so every slot is out of view.
    await waitFor(() => expect(transform()).not.toBe(initial));
  });
});

describe("Diagram edges", () => {
  const path = (edgeId: string) =>
    document.querySelector<SVGPathElement>(`[data-edge-id="${edgeId}"] path`);

  it("are thin, dotted and faint at rest, and primary and moving only on the playing step", async () => {
    const user = userEvent.setup();
    renderBoard();
    const firstStep = pdfScenario.diagram.edges.filter((e) => e.step === 1).map((e) => e.id);
    const other = pdfScenario.diagram.edges.find((e) => e.step !== 1)?.id ?? "";
    const idle = path(firstStep[0] ?? "");
    expect(idle?.style.stroke).toBe("var(--muted-foreground)");
    expect(idle?.style.strokeDasharray).toBe("4 3");
    expect(idle?.style.strokeOpacity).toBe("0.58");
    expect(idle?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
    expect(idle?.querySelector("animate")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Reproducir flujo" }));
    for (const id of firstStep) {
      expect(path(id)?.style.stroke).toBe("var(--primary)");
      expect(path(id)?.style.strokeOpacity).toBe("1");
      expect(path(id)?.querySelector("animate")).not.toBeNull();
    }
    expect(path(other)?.style.stroke).toBe("var(--muted-foreground)");
    expect(path(other)?.querySelector("animate")).toBeNull();
  });
});
