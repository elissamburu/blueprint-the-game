// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The "Diagrama" tab over the real scenario.yaml of the 200 scenario: the canvas and the inspector
// edit the text with the same commands as the form, removing asks first, a new element takes the
// focus to its first field in the inspector, every change is said in the status line, and a text
// that does not parse leaves everything read-only. The YAML editor is replaced by a harness that
// applies the commands to the text, as the editor does.
import { mockReactFlowLayout } from "@blueprint/diagram/testing";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useImperativeHandle, useState, type Ref } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { parseDocument } from "yaml";
import type { StudioFinding } from "../../shared/validation";
import { moveStep } from "../form/diagram-edit";
import { planEdits, type EditCommand, type EditPath } from "../form/document-edit";
import { pdfYaml, shared } from "../testing/content-fixture";
import { DiagramTab, elementIssues } from "./DiagramTab";

beforeAll(mockReactFlowLayout);
afterEach(cleanup);

interface HarnessHandle {
  text: string;
  setText: (text: string) => void;
}

function Harness({
  initial = pdfYaml,
  findings = [],
  onOpenInForm = vi.fn(),
  onUndo = vi.fn(),
  onEdit = vi.fn(),
  ref,
}: {
  initial?: string;
  findings?: StudioFinding[];
  onOpenInForm?: (path: EditPath) => void;
  onUndo?: () => void;
  /** Sees every edit, as the editor gets it. */
  onEdit?: (commands: readonly EditCommand[], isolate: boolean) => void;
  ref?: Ref<HarnessHandle>;
}) {
  const [text, setText] = useState(initial);
  useImperativeHandle(ref, () => ({ text, setText }), [text]);
  return (
    <div style={{ width: 1200, height: 900 }}>
      <DiagramTab
        text={text}
        findings={findings}
        shared={shared}
        onEdit={(commands, isolate) => {
          onEdit(commands, isolate);
          setText((current) => planEdits(current, commands).text);
        }}
        onUndo={onUndo}
        onRedo={vi.fn()}
        onSave={vi.fn()}
        onJumpToLine={vi.fn()}
        onOpenInForm={onOpenInForm}
      />
    </div>
  );
}

const setup = (props: Omit<Parameters<typeof Harness>[0], "ref"> = {}) => {
  const handle: { current: HarnessHandle | null } = { current: null };
  const user = userEvent.setup();
  render(<Harness {...props} ref={(value) => void (handle.current = value)} />);
  const data = () =>
    parseDocument(handle.current?.text ?? "").toJS() as {
      diagram: {
        nodes: Record<string, unknown>[];
        edges: Record<string, unknown>[];
        groups: Record<string, unknown>[];
      };
    };
  const setText = (text: string) => act(() => handle.current?.setText(text));
  return { user, text: () => handle.current?.text ?? "", data, setText };
};

const canvas = () => screen.getByRole("application", { name: "Diagrama del escenario" });
const element = (key: string) => {
  const found = canvas().querySelector<HTMLElement>(`[data-diagram-element="${key}"]`);
  if (found === null) throw new Error(`no element ${key}`);
  return found;
};
const inspector = () => screen.getByRole("region", { name: "Inspector" });
const statusLine = () =>
  document.querySelector<HTMLElement>('[data-slot="diagram-status"]')?.textContent ?? "";

describe("DiagramTab", () => {
  it("draws the diagram and, without a selection, shows the flow", () => {
    setup();
    expect(element("node:api-entry").getAttribute("aria-label")).toMatch(/^Casillero 1: /);
    expect(within(inspector()).getByRole("heading", { name: "Flujo" })).toBeTruthy();
    expect(within(inspector()).getAllByRole("button")[0]?.textContent).toMatch(/^Paso 1: /);
  });

  it("moves a node with the arrows and says where it is, once per burst", async () => {
    const { user, data } = setup();
    element("node:api-entry").focus();
    await user.keyboard("{ArrowRight}{ArrowRight}{Shift>}{ArrowDown}{/Shift}");
    const node = data().diagram.nodes.find((item) => item.id === "api-entry");
    expect(node?.position).toEqual({ x: 320, y: 161 });
    await waitFor(() =>
      expect(statusLine()).toMatch(/^El casillero 1 «.*» queda en x 320, y 161\.$/),
    );
  });

  it("puts a node in the group it lands in, and says so", async () => {
    const { user, data } = setup();
    element("node:client").focus();
    // The client is at x 40, left of the cloud (x 200): 20 presses move it in.
    await user.keyboard("{ArrowRight>20/}");
    const client = data().diagram.nodes.find((item) => item.id === "client");
    expect(client).toMatchObject({ position: { x: 240, y: 472 }, group: "cloud" });
    await waitFor(() => expect(statusLine()).toMatch(/Ahora está en Nube\.$/));
  });

  it("asks before removing, and removes the node with its edges", async () => {
    const { user, data } = setup();
    const edges = data().diagram.edges.length;
    element("node:client").focus();
    await user.keyboard("{Delete}");
    const dialog = screen.getByRole("alertdialog", {
      name: "¿Eliminar el actor «Cliente del estudio»?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    expect(data().diagram.nodes.some((item) => item.id === "client")).toBe(false);
    expect(data().diagram.edges.length).toBeLessThan(edges);
    expect(statusLine()).toBe("Se eliminó el actor «Cliente del estudio».");
    await waitFor(() => expect(document.activeElement).toBe(canvas()));
  });

  it("adds a node from the palette, incomplete, with the focus in its first field", async () => {
    const { user, data } = setup();
    const count = data().diagram.nodes.length;
    await user.click(screen.getByRole("button", { name: "Agregar Casillero" }));
    expect(data().diagram.nodes).toHaveLength(count + 1);
    expect(data().diagram.nodes.at(-1)).toMatchObject({ id: "nuevo-slot", role: "", answers: [] });
    expect(element("node:nuevo-slot").getAttribute("aria-label")).toMatch(/Incompleto$/);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(inspector()).getByRole("textbox", { name: "Rol" }),
      ),
    );
    await user.keyboard("Guarda los PDF");
    expect(data().diagram.nodes.at(-1)?.role).toBe("Guarda los PDF");
    expect(statusLine()).toBe("Se agregó un casillero: completá sus datos en el inspector.");
  });

  it("connects two nodes without dragging, and takes the focus to the label of the edge", async () => {
    const { user, data } = setup();
    const count = data().diagram.edges.length;
    element("node:client").focus();
    await user.keyboard("c");
    const dialog = screen.getByRole("dialog", { name: "Conectar «Cliente del estudio» con…" });
    await user.type(within(dialog).getByRole("searchbox", { name: "Buscar" }), "logs");
    await user.click(within(dialog).getByRole("button", { name: "Conectar" }));
    expect(data().diagram.edges).toHaveLength(count + 1);
    expect(data().diagram.edges.at(-1)).toMatchObject({ from: "client", to: "logs", label: "" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(inspector()).getByRole("textbox", { name: "Etiqueta" }),
      ),
    );
  });

  it("edits the selection in the inspector, following a renamed id", async () => {
    const { user, data } = setup();
    element("node:client").focus();
    await user.keyboard("{Enter}");
    const label = within(inspector()).getByRole("textbox", { name: "Etiqueta" });
    expect(document.activeElement).toBe(label);
    await user.type(label, " web");
    expect(data().diagram.nodes[0]?.label).toBe("Cliente del estudio web");
    const id = within(inspector()).getByRole("textbox", { name: "Id" });
    await user.type(id, "-web");
    expect(data().diagram.nodes[0]?.id).toBe("client-web");
    // Still selected after the rename: the inspector stays on it.
    expect(within(inspector()).getByRole("heading", { name: "Actor · client-web" })).toBeTruthy();
    // Single-key shortcuts of the canvas do nothing in a text field (WCAG 2.1.4).
    await user.type(id, "c{Delete}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("moves an edge one step later from the inspector, as the form does", async () => {
    const { user, data } = setup();
    const steps = data().diagram.edges.map((edge) => Number(edge.step));
    const first = steps.indexOf(1);
    const expected = moveStep(steps, first, 1);
    // The first step of the flow, selected from the list of the inspector.
    await user.click(within(inspector()).getAllByRole("button")[0] as HTMLElement);
    await user.click(within(inspector()).getByRole("button", { name: /Después en el flujo/ }));
    expect(data().diagram.edges.map((edge) => edge.step)).toEqual(expected);
    expect(statusLine()).toMatch(
      new RegExp(`^La arista de .*: ahora es el paso ${String(expected[first])}\\.$`),
    );
  });

  it("sends the author to the form for the answers of a slot", async () => {
    const onOpenInForm = vi.fn();
    const { user } = setup({ onOpenInForm });
    act(() => element("node:api-entry").focus());
    await user.click(
      within(inspector()).getByRole("button", { name: "Editar respuestas en el formulario" }),
    );
    expect(onOpenInForm).toHaveBeenCalledWith(["diagram", "nodes", 2, "answers"]);
  });

  it("is read-only while the text does not parse, with the last diagram that did", () => {
    const { setText } = setup();
    setText(`${pdfYaml}\nbroken: [`);
    expect(screen.getByText(/el diagrama se muestra en solo lectura/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Agregar Actor" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(element("node:client")).toBeTruthy();
  });

  it("says when there is no diagram to show yet", () => {
    setup({ initial: "diagram: [" });
    expect(screen.getByText(/todavía no hay un diagrama para mostrar/)).toBeTruthy();
    expect(screen.queryByRole("application")).toBeNull();
  });

  it("marks the elements with issues and lists the ones no field shows", () => {
    const finding: StudioFinding = {
      code: "L007",
      severity: "error",
      message: "Se superpone con otro nodo",
      where: "diagram.nodes[2]",
      path: ["diagram", "nodes", 2, "position"],
      line: 1,
      column: 1,
    };
    setup({ findings: [finding] });
    expect(element("node:api-entry").getAttribute("aria-label")).toMatch(/Con errores$/);
    act(() => element("node:api-entry").focus());
    expect(within(inspector()).getByText("Se superpone con otro nodo")).toBeTruthy();
  });
});

describe("Ordenar", () => {
  const arrangeButton = () => screen.getByRole("button", { name: /^(Ordenar|Ordenando…)$/ });

  it("lays the diagram out in one isolated edit, says what moved and offers to undo it", async () => {
    const onEdit = vi.fn();
    const onUndo = vi.fn();
    const { user, data, text } = setup({ onEdit, onUndo });
    await user.click(arrangeButton());
    await waitFor(() => expect(statusLine()).toMatch(/^Se reubicaron \d+ nodos y 1 grupo\.$/));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit.mock.calls[0]?.[1]).toBe(true);
    for (const command of onEdit.mock.calls[0]?.[0] as EditCommand[]) {
      expect(command.op).toBe("set");
      expect(command.path[0]).toBe("diagram");
      expect(command.path).toEqual(
        expect.arrayContaining([expect.stringMatching(/^(position|rect|canvas)$/)]),
      );
    }
    expect(arrangeButton().getAttribute("aria-busy")).toBeNull();
    expect(data().diagram.groups[0]?.rect).not.toEqual({ x: 200, y: 60, w: 1160, h: 700 });
    const laidOut = text();

    // Ordering again changes nothing.
    await user.click(arrangeButton());
    await waitFor(() => expect(statusLine()).toBe("Ya está ordenado."));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(text()).toBe(laidOut);
    // "Deshacer" stays while the layout is the last edit.
    const undo = screen.getByRole("button", { name: "Deshacer el orden" });
    await user.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(statusLine()).toBe("Se deshizo el orden.");
    expect(screen.queryByRole("button", { name: "Deshacer el orden" })).toBeNull();
    expect(document.activeElement).toBe(arrangeButton());
  });

  it("stops offering to undo once another edit comes after it", async () => {
    const { user } = setup();
    await user.click(arrangeButton());
    await screen.findByRole("button", { name: "Deshacer el orden" });
    element("node:api-entry").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.queryByRole("button", { name: "Deshacer el orden" })).toBeNull();
  });

  it("asks first when sibling groups overlap, naming them", async () => {
    const overlapping = planEdits(pdfYaml, [
      {
        op: "append",
        path: ["diagram", "groups"],
        value: {
          id: "shared",
          kind: "generic",
          label: "Servicios compartidos",
          rect: { x: 1000, y: 600, w: 600, h: 300 },
          parent: null,
        },
      },
      { op: "set", path: ["diagram", "canvas", "width"], value: 1700 },
      { op: "set", path: ["diagram", "canvas", "height"], value: 1000 },
    ]).text;
    const onEdit = vi.fn();
    const { user } = setup({ initial: overlapping, onEdit });

    await user.click(arrangeButton());
    const dialog = await screen.findByRole("alertdialog", { name: "Hay grupos superpuestos" });
    expect(dialog.textContent).toContain(
      "Se superponen el grupo «Nube» con «Servicios compartidos».",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onEdit).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(arrangeButton()));

    await user.click(arrangeButton());
    const again = await screen.findByRole("alertdialog", { name: "Hay grupos superpuestos" });
    await user.click(within(again).getByRole("button", { name: "Ordenar igual" }));
    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(statusLine()).toMatch(/^Se reubicaron \d+ nodos y 2 grupos\.$/));
  });

  it("cannot order while the text does not parse", () => {
    const { setText } = setup();
    setText(`${pdfYaml}\nbroken: [`);
    expect(arrangeButton()).toHaveProperty("disabled", true);
  });
});

describe("elementIssues", () => {
  it("keeps the worst issue of each element, by id", () => {
    const raw = parseDocument(pdfYaml).toJS() as unknown;
    const at = (path: StudioFinding["path"], severity: StudioFinding["severity"]) => ({
      code: "L0",
      severity,
      message: "",
      where: "",
      path,
      line: 1,
      column: 1,
    });
    const issues = elementIssues(raw, [
      at(["diagram", "nodes", 1, "service"], "warning"),
      at(["diagram", "nodes", 1], "error"),
      at(["diagram", "nodes", 1, "group"], "warning"),
      at(["diagram", "groups", 0, "rect"], "warning"),
      at(["title"], "error"),
      at(["diagram", "edges", 99], "error"),
    ]);
    expect(Object.fromEntries(issues)).toEqual({ "node:logs": "error", "group:cloud": "warning" });
  });
});
