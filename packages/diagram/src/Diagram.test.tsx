// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { DndContext } from "@dnd-kit/core";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { ARROW_PAN, Diagram, type DiagramHandle } from "./Diagram";
import { nodeBox } from "./geometry";
import { fakeServices, pdfScenario, staticWebsiteScenario } from "./testing/fixtures";

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

const board = () => screen.getByRole("group", { name: "Diagrama de la arquitectura" });

const slotButtons = () =>
  screen.getAllByRole("button").filter((b) => b.dataset.slot === "architecture-slot-main");

describe("Diagram slots", () => {
  it("are reachable with Tab in diagram order and activate with Enter and Space", async () => {
    const user = userEvent.setup();
    const onSlotActivate = vi.fn();
    renderBoard({ onSlotActivate });

    board().focus();
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
    const strip = screen.getByRole("list", { name: "Pasos del flujo" });
    expect(board().getAttribute("aria-describedby")?.split(" ")).toContain(strip.id);
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
    board().focus();
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

/** Viewport of the board read from React Flow's transform: translate(x, y) scale(zoom). */
const viewport = () => {
  const transform = document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform;
  const match = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\) scale\(([\d.e]+)\)/.exec(
    transform ?? "",
  );
  if (match === null) throw new Error(`no viewport in ${transform}`);
  return { x: Number(match[1]), y: Number(match[2]), zoom: Number(match[3]) };
};

describe("Diagram zoom and pan", () => {
  /** The board measures 1200 × 800, as in a browser (jsdom has no layout). */
  const BOARD = { width: 1200, height: 800 };
  const sized = (element: HTMLElement) =>
    element.classList.contains("react-flow") || element.getAttribute("role") === "group";
  beforeAll(() => {
    const size = (dimension: "width" | "height") =>
      function (this: HTMLElement) {
        return sized(this) ? BOARD[dimension] : parseFloat(this.style[dimension]) || 1;
      };
    Object.defineProperties(HTMLElement.prototype, {
      offsetWidth: { configurable: true, get: size("width") },
      offsetHeight: { configurable: true, get: size("height") },
      clientWidth: { configurable: true, get: size("width") },
      clientHeight: { configurable: true, get: size("height") },
    });
  });

  const zoomIn = async (user: ReturnType<typeof userEvent.setup>, times: number) => {
    const plus = screen.getByRole("button", { name: "Acercar" });
    for (let i = 0; i < times; i++) {
      const before = viewport().zoom;
      await user.click(plus);
      await waitFor(() => expect(viewport().zoom).not.toBe(before));
      // The button animates (150 ms): wait until it settles on the step.
      await waitFor(() => expect((viewport().zoom * 4) % 1).toBeCloseTo(0, 5));
    }
  };

  it("zooms in 25 % steps up to 300 %, then disables Acercar", async () => {
    const user = userEvent.setup();
    renderBoard({ onSlotActivate: () => {} });
    await waitFor(() => expect(viewport().zoom).toBeGreaterThan(0));
    const plus = screen.getByRole("button", { name: "Acercar" });
    for (let i = 0; i < 20 && !plus.hasAttribute("disabled"); i++) await zoomIn(user, 1);
    expect(viewport().zoom).toBe(3);
    expect(screen.getByLabelText("Nivel de zoom").textContent).toMatch(/^300\s?%$/);
    expect(plus.hasAttribute("disabled")).toBe(true);
  });

  it("pans with the arrows while the board has the focus, not while a slot has it", async () => {
    const user = userEvent.setup();
    renderBoard({ onSlotActivate: () => {} });
    await waitFor(() => expect(viewport().zoom).toBeGreaterThan(0));
    const start = viewport();
    board().focus();
    await user.keyboard("{ArrowRight}");
    expect(viewport().x).toBeCloseTo(start.x - ARROW_PAN);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(viewport().y).toBeCloseTo(start.y - 2 * ARROW_PAN);
    await user.keyboard("{ArrowLeft}{ArrowUp}");
    expect(viewport()).toEqual({ ...start, x: start.x, y: start.y - ARROW_PAN });
    const moved = viewport();
    slotButtons()[0]?.focus();
    await user.keyboard("{ArrowRight}");
    expect(viewport()).toEqual(moved);
  });

  it("at 300 % reaches with Tab a slot that starts out of view, and shows it whole", async () => {
    const user = userEvent.setup();
    renderBoard({ diagram: staticWebsiteScenario.diagram, onSlotActivate: () => {} });
    await waitFor(() => expect(viewport().zoom).toBeGreaterThan(0));
    const plus = screen.getByRole("button", { name: "Acercar" });
    for (let i = 0; i < 20 && !plus.hasAttribute("disabled"); i++) await zoomIn(user, 1);
    expect(viewport().zoom).toBe(3);

    const inView = (box: { x: number; y: number; w: number; h: number }) => {
      const { x, y, zoom } = viewport();
      const left = box.x * zoom + x;
      const top = box.y * zoom + y;
      return (
        left >= 0 &&
        top >= 0 &&
        left + box.w * zoom <= BOARD.width &&
        top + box.h * zoom <= BOARD.height
      );
    };
    const slots = staticWebsiteScenario.diagram.nodes.filter((n) => n.type === "slot");
    const last = slots.at(-1);
    if (last === undefined) throw new Error("no slots");
    expect(inView(nodeBox(last))).toBe(false);

    board().focus();
    for (const slot of slots) {
      await user.tab();
      expect(document.activeElement?.closest("[data-slot-id]")?.getAttribute("data-slot-id")).toBe(
        slot.id,
      );
      await waitFor(() => expect(inView(nodeBox(slot))).toBe(true));
      expect(viewport().zoom).toBe(3);
    }
  });
});

describe("Diagram handle", () => {
  it("plays the flow and pans the board on request", async () => {
    const ref = createRef<DiagramHandle>();
    renderBoard({ ref, playButton: false, stepList: "hidden" });
    expect(screen.queryByRole("button", { name: "Reproducir flujo" })).toBeNull();
    await waitFor(() => expect(viewport().zoom).toBeGreaterThan(0));
    act(() => ref.current?.playFlow());
    expect(await screen.findByRole("group", { name: "Reproductor de flujo" })).toBeTruthy();
    expect(document.querySelector("p[aria-live]")?.textContent).toMatch(/^Paso 1 de 9:/);

    const start = viewport();
    act(() => ref.current?.panBy(40, -30));
    await waitFor(() => expect(viewport()).toEqual({ ...start, x: start.x + 40, y: start.y - 30 }));
    expect(ref.current?.element()).toBe(board());
  });

  it("keeps the hidden step list as the description of the board", () => {
    renderBoard({ stepList: "hidden" });
    const list = document.getElementById(
      board().getAttribute("aria-describedby")?.split(" ")[0] ?? "",
    );
    expect(list?.hidden).toBe(true);
    expect(list?.textContent).toContain("Paso 1: Pide subir un comprobante");
    // The route names the actor and the role, never a hidden service.
    expect(list?.textContent).toContain(" → ");
  });
});

describe("Diagram preview", () => {
  it("is a still picture: no controls, no focusable slots, and slots without text", () => {
    renderBoard({ preview: true, label: "Vista previa" });
    const picture = screen.getByRole("img", { name: "Vista previa" });
    expect(within(picture).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Zoom" })).toBeNull();
    const slots = picture.querySelectorAll('[data-slot="architecture-slot"]');
    expect(slots).toHaveLength(slotIds.length);
    for (const slot of slots) expect(slot.textContent).toBe("");
  });
});
