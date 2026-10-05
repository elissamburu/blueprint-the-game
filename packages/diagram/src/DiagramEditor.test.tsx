// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { parseDiagramDraft, type DiagramDraft } from "@blueprint/scenario-schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DiagramEditor, EDITOR_HELP, type DiagramEditorProps } from "./DiagramEditor";
import type { DiagramCommand, DiagramSelection } from "./editor-model";
import { fakeServices } from "./testing/fixtures";
import { mockReactFlowLayout } from "./testing/react-flow-mocks";

beforeAll(mockReactFlowLayout);
afterEach(cleanup);

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

const draft: DiagramDraft = parseDiagramDraft({
  canvas: { width: 1200, height: 800 },
  groups: [{ id: "vpc", kind: "vpc", label: "VPC", rect: rect(300, 40, 600, 400), parent: null }],
  nodes: [
    { id: "user", type: "actor", label: "Usuario", icon: "user", position: { x: 40, y: 100 } },
    { id: "api", type: "fixed", service: "api", position: { x: 340, y: 100 }, group: "vpc" },
    {
      id: "store",
      type: "slot",
      role: "",
      answers: [],
      position: { x: 600, y: 100 },
      group: "vpc",
    },
  ],
  edges: [
    { id: "e1", from: "user", to: "api", step: 1, label: "Pide", style: "sync" },
    { id: "e2", from: "api", to: "store", step: 2, label: "Guarda", style: "sync" },
  ],
});

/** The editor with its selection kept, as the app keeps it. */
function Harness(props: Partial<DiagramEditorProps> & { initial?: DiagramSelection | null }) {
  const { initial = null, ...rest } = props;
  const [selection, setSelection] = useState<DiagramSelection | null>(initial);
  return (
    <div style={{ width: 1200, height: 800 }}>
      <button type="button">Antes</button>
      <DiagramEditor
        draft={draft}
        services={fakeServices}
        selection={selection}
        onSelectionChange={setSelection}
        onCommand={() => {}}
        {...rest}
      />
      <button type="button">Después</button>
    </div>
  );
}

const canvas = () => screen.getByRole("application", { name: "Editor del diagrama" });
const element = (key: string) => {
  const found = canvas().querySelector<HTMLElement>(`[data-diagram-element="${key}"]`);
  if (found === null) throw new Error(`no element ${key}`);
  return found;
};
const nameOf = (target: Element) => target.getAttribute("aria-label");
const focusedKey = () => document.activeElement?.getAttribute("data-diagram-element");

const setup = (props: Partial<Parameters<typeof Harness>[0]> = {}) => {
  const onCommand = vi.fn<(command: DiagramCommand) => void>();
  const user = userEvent.setup();
  render(<Harness onCommand={onCommand} {...props} />);
  return { user, onCommand };
};

describe("DiagramEditor: elements", () => {
  it("names every element, with its state in words", () => {
    setup();
    expect(nameOf(element("node:user"))).toBe("Actor: Usuario. sin grupo, x 40, y 100");
    expect(nameOf(element("node:store"))).toBe(
      "Casillero 1: (sin rol). en VPC, x 600, y 100. Incompleto",
    );
    expect(nameOf(element("group:vpc"))).toBe("Grupo VPC: VPC. x 300, y 40, ancho 600, alto 400");
    expect(nameOf(element("edge:e1"))).toBe("Arista, paso 1: de Usuario a Servicio api, «Pide»");
    expect(within(element("node:store")).getByText("Incompleto")).toBeTruthy();
  });

  it("shows the issues of the app on its elements", () => {
    setup({ issues: new Map([["node:api", "error"]]) });
    expect(nameOf(element("node:api"))).toBe(
      "Servicio fijo: Servicio api. en VPC, x 340, y 100. Con errores",
    );
  });

  it("has a visible help that says how to leave the canvas", () => {
    setup();
    const help = document.getElementById(canvas().getAttribute("aria-describedby") ?? "");
    expect(help?.textContent).toBe(EDITOR_HELP);
    expect(help?.hidden).toBe(false);
    expect(EDITOR_HELP).toContain("Esc y después Tab");
  });
});

describe("DiagramEditor: keyboard", () => {
  it("goes through the elements in reading order with Tab and Shift+Tab", async () => {
    const { user } = setup();
    canvas().focus();
    await user.tab();
    expect(focusedKey()).toBe("group:vpc");
    await user.tab();
    expect(focusedKey()).toBe("node:user");
    await user.tab();
    expect(focusedKey()).toBe("node:api");
    await user.tab({ shift: true });
    expect(focusedKey()).toBe("node:user");
    await user.tab({ shift: true });
    await user.tab({ shift: true });
    // From the first element, back to the last: the edge of the last step.
    expect(focusedKey()).toBe("edge:e2");
  });

  it("leaves the canvas with Esc and then Tab", async () => {
    const { user } = setup();
    canvas().focus();
    await user.tab();
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(canvas());
    await user.tab();
    expect(canvas().contains(document.activeElement)).toBe(false);
    // Back with Shift+Tab from outside: the canvas, then Tab goes in again.
    await user.click(screen.getByRole("button", { name: "Antes" }));
    canvas().focus();
    await user.keyboard("{Escape}");
    await user.tab({ shift: true });
    expect(canvas().contains(document.activeElement)).toBe(false);
  });

  it("moves the selection with the arrows by 10, and by 1 with Shift", async () => {
    const { user, onCommand } = setup({ initial: { kind: "node", id: "api" } });
    element("node:api").focus();
    await user.keyboard("{ArrowRight}");
    expect(onCommand).toHaveBeenLastCalledWith({
      type: "place",
      input: "keyboard",
      placements: [{ kind: "node", id: "api", position: { x: 350, y: 100 }, group: "vpc" }],
    });
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(onCommand).toHaveBeenLastCalledWith({
      type: "place",
      input: "keyboard",
      placements: [{ kind: "node", id: "api", position: { x: 340, y: 99 }, group: "vpc" }],
    });
  });

  it("resizes a group with Alt and the arrows", async () => {
    const { user, onCommand } = setup({ initial: { kind: "group", id: "vpc" } });
    element("group:vpc").focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    expect(onCommand).toHaveBeenLastCalledWith({
      type: "place",
      input: "keyboard",
      placements: [{ kind: "group", id: "vpc", rect: rect(300, 40, 600, 410), parent: null }],
    });
  });

  it("asks to remove with Supr, activates with Enter, and moves a step with Alt+Av Pág", async () => {
    const onActivate = vi.fn();
    const { user, onCommand } = setup({ initial: { kind: "edge", id: "e1" }, onActivate });
    element("edge:e1").focus();
    await user.keyboard("{Delete}");
    expect(onCommand).toHaveBeenLastCalledWith({
      type: "remove",
      target: { kind: "edge", id: "e1" },
    });
    await user.keyboard("{Enter}");
    expect(onActivate).toHaveBeenCalledWith({ kind: "edge", id: "e1" });
    await user.keyboard("{Alt>}{PageDown}{/Alt}");
    expect(onCommand).toHaveBeenLastCalledWith({ type: "moveStep", edgeId: "e1", direction: 1 });
  });

  it("sends Ctrl+Z and Ctrl+Y to the app's history", async () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { user } = setup({ onUndo, onRedo });
    canvas().focus();
    await user.keyboard("{Control>}z{/Control}{Control>}y{/Control}");
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it("connects without dragging: C, a destination from the list, Conectar", async () => {
    const { user, onCommand } = setup({ initial: { kind: "node", id: "user" } });
    element("node:user").focus();
    await user.keyboard("c");
    const dialog = screen.getByRole("dialog", { name: "Conectar «Usuario» con…" });
    expect(within(dialog).getByText(/paso 3/)).toBeTruthy();
    await user.type(within(dialog).getByRole("searchbox", { name: "Buscar" }), "casill");
    expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
    await user.click(within(dialog).getByRole("button", { name: "Conectar" }));
    expect(onCommand).toHaveBeenLastCalledWith({ type: "connect", from: "user", to: "store" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("DiagramEditor: single-key shortcuts (WCAG 2.1.4)", () => {
  it("never act while a text field has the focus", async () => {
    const onUndo = vi.fn();
    const onActivate = vi.fn();
    const { user, onCommand } = setup({
      initial: { kind: "node", id: "user" },
      onUndo,
      onActivate,
    });
    element("node:user").focus();
    await user.keyboard("C");
    const search = screen.getByRole("searchbox", { name: "Buscar" });
    expect(document.activeElement).toBe(search);
    // Inside the dialog's field (React events bubble through the portal to the canvas).
    await user.keyboard("cC{Delete}{ArrowRight}{Control>}z{/Control}");
    expect((search as HTMLInputElement).value).toBe("cC");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(onCommand).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("act on the canvas and its elements only", async () => {
    const { user, onCommand } = setup({ initial: { kind: "node", id: "api" } });
    screen.getByRole("button", { name: "Después" }).focus();
    await user.keyboard("c{Delete}{ArrowRight}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onCommand).not.toHaveBeenCalled();
  });
});

describe("DiagramEditor: palette and toolbar", () => {
  it("adds a node at the center of the view and asks to remove the selection", async () => {
    const { user, onCommand } = setup({ initial: { kind: "group", id: "vpc" } });
    await user.click(screen.getByRole("button", { name: "Agregar Casillero" }));
    expect(onCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "addNode", nodeType: "slot" }),
    );
    await user.click(screen.getByRole("button", { name: "Agregar Zona de disponibilidad" }));
    expect(onCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "addGroup", kind: "az" }),
    );
    await user.click(screen.getByRole("button", { name: /Eliminar…/ }));
    expect(onCommand).toHaveBeenLastCalledWith({
      type: "remove",
      target: { kind: "group", id: "vpc" },
    });
  });

  it("offers Conectar con… only with a node selected", async () => {
    const { user } = setup({ initial: { kind: "edge", id: "e1" } });
    expect(screen.getByRole("button", { name: /Conectar con…/ }).hasAttribute("disabled")).toBe(true);
    element("edge:e1").focus();
    await user.keyboard("c");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes nothing while read-only", async () => {
    const { user, onCommand } = setup({ initial: { kind: "node", id: "api" }, readOnly: true });
    expect(screen.getByRole("button", { name: "Agregar Actor" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: /Eliminar…/ }).hasAttribute("disabled")).toBe(true);
    element("node:api").focus();
    await user.keyboard("{ArrowRight}{Delete}c");
    expect(onCommand).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says how many elements it cannot draw", () => {
    render(
      <DiagramEditor
        draft={parseDiagramDraft({ nodes: [{ id: "x", type: "nube" }, { id: "y" }] })}
        services={fakeServices}
        selection={null}
        onSelectionChange={() => {}}
        onCommand={() => {}}
      />,
    );
    expect(screen.getByText(/^2 elementos no se pueden dibujar/)).toBeTruthy();
  });
});
