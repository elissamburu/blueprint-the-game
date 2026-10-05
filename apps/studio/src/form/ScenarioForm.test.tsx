// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The form over the real scenario.yaml of the 200 scenario: its fields edit the text by path, the
// issues go to their fields, removing asks first and every move or removal is announced, and a
// text that does not parse leaves it read-only. The YAML editor is replaced by a harness that
// applies the commands to the text, as the editor does.
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioFinding } from "../../shared/validation";
import { pdfYaml, shared } from "../testing/content-fixture";
import { planEdits } from "./document-edit";
import { ScenarioForm, type ScenarioFormHandle } from "./ScenarioForm";
import { filterServices } from "./ServicePicker";

afterEach(cleanup);

interface HarnessHandle {
  form: () => ScenarioFormHandle | null;
  text: string;
}

function Harness({
  initial,
  findings = [],
  onUndo = vi.fn(),
  onJumpToLine = vi.fn(),
  ref,
}: {
  initial: string;
  findings?: StudioFinding[];
  onUndo?: () => void;
  onJumpToLine?: (line: number) => void;
  ref?: Ref<HarnessHandle>;
}) {
  const [text, setText] = useState(initial);
  const form = useRef<ScenarioFormHandle>(null);
  useImperativeHandle(ref, () => ({ form: () => form.current, text }), [text]);
  return (
    <ScenarioForm
      ref={form}
      text={text}
      findings={findings}
      shared={shared}
      onEdit={(commands) => setText((current) => planEdits(current, commands).text)}
      onUndo={onUndo}
      onRedo={vi.fn()}
      onSave={vi.fn()}
      onJumpToLine={onJumpToLine}
    />
  );
}

const setup = (props: Omit<Parameters<typeof Harness>[0], "ref">) => {
  const handle: { current: HarnessHandle | null } = { current: null };
  render(<Harness {...props} ref={(value) => void (handle.current = value)} />);
  const get = () => {
    if (handle.current === null) throw new Error("no harness");
    return handle.current;
  };
  return { text: () => get().text, form: () => get().form() };
};

const valueOf = (element: HTMLElement): string => (element as HTMLInputElement).value;
const descriptionOf = (element: HTMLElement): string =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const finding = (path: StudioFinding["path"], message: string): StudioFinding => ({
  code: "L005",
  severity: "error",
  message,
  where: path.join("."),
  path,
  line: 1,
  column: 1,
});

describe("ScenarioForm", () => {
  it("edits the title by its path: only that line of the YAML changes", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml });
    const title = screen.getByRole("textbox", { name: "Título" });
    await user.type(title, " (2)");
    expect(valueOf(title)).toBe("Comprobantes en PDF para un estudio contable (2)");
    expect(text()).toBe(
      pdfYaml.replace(
        'title: "Comprobantes en PDF para un estudio contable"',
        'title: "Comprobantes en PDF para un estudio contable (2)"',
      ),
    );
    expect(screen.getByRole("textbox", { name: "Id" }).hasAttribute("readonly")).toBe(true);
  });

  it("gives unique names to the repeated fields of the slots", async () => {
    const user = userEvent.setup();
    setup({ initial: pdfYaml });
    await user.click(screen.getByRole("button", { name: "Casilleros" }));
    await user.click(screen.getByRole("button", { name: /^Casillero 2:/ }));
    expect(
      valueOf(screen.getByRole("textbox", { name: "Rationale de la respuesta 2 del casillero 2" })),
    ).toContain("contenedores");
    screen.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 2 AWS Lambda/ });
    screen.getByRole("group", { name: "Objetivos vinculados de la respuesta 1 del casillero 2" });
  });

  it("links an objective to an answer and unlinks it, with the finest edit", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml });
    await user.click(screen.getByRole("button", { name: "Casilleros" }));
    await user.click(screen.getByRole("button", { name: /^Casillero 1:/ }));
    const group = screen.getByRole("group", {
      name: "Objetivos vinculados de la respuesta 1 del casillero 1",
    });
    const noMl = within(group).getByRole("checkbox", { name: /no-ml-team/ });
    expect(noMl.getAttribute("aria-checked")).toBe("false");
    await user.click(noMl);
    expect(text()).toContain("objectives: [no-servers, sporadic-traffic, low-cost, no-ml-team]");
    await user.click(within(group).getByRole("checkbox", { name: /no-ml-team/ }));
    expect(text()).toBe(pdfYaml);
  });

  it("adds an objective, focuses it, and removes it after confirming", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml });
    await user.click(screen.getByRole("button", { name: "Objetivos" }));
    await user.click(screen.getByRole("button", { name: "Agregar objetivo" }));
    expect(screen.getByRole("status").textContent).toBe("Se agregó el objetivo 6.");
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Id del objetivo 6" }));
    expect(valueOf(screen.getByRole("textbox", { name: "Id del objetivo 6" }))).toBe(
      "nuevo-objetivo",
    );

    await user.click(screen.getByRole("button", { name: "Subir el objetivo 6" }));
    expect(screen.getByRole("status").textContent).toBe(
      "el objetivo 6: ahora en la posición 5 de 6.",
    );
    expect(valueOf(screen.getByRole("textbox", { name: "Id del objetivo 5" }))).toBe(
      "nuevo-objetivo",
    );

    await user.click(screen.getByRole("button", { name: "Quitar el objetivo 5" }));
    const dialog = screen.getByRole("alertdialog", { name: "¿Quitar el objetivo 5?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(valueOf(screen.getByRole("textbox", { name: "Id del objetivo 5" }))).toBe(
      "nuevo-objetivo",
    );
    await user.click(screen.getByRole("button", { name: "Quitar el objetivo 5" }));
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Quitar" }),
    );
    expect(screen.getByRole("status").textContent).toBe("Se quitó el objetivo 5.");
    expect(screen.queryByRole("textbox", { name: "Id del objetivo 6" })).toBeNull();
    expect(text()).not.toContain("nuevo-objetivo");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Agregar objetivo" }));
  });

  it("shows the issues of a field and takes the focus to it, opening its sections", () => {
    const rationale = ["diagram", "nodes", 2, "answers", 0, "rationale"];
    const { form } = setup({
      initial: pdfYaml,
      findings: [finding(rationale, "Nombra un servicio oculto.")],
    });
    expect(screen.queryByRole("textbox", { name: /^Rationale/ })).toBeNull();
    act(() => {
      expect(form()?.focusPath(rationale)).toBe(true);
    });
    const field = screen.getByRole("textbox", {
      name: "Rationale de la respuesta 1 del casillero 1",
    });
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(field)).toBe("Error L005: Nombra un servicio oculto.");
    expect(form()?.focusPath(["palette", "mode"])).toBe(false);
  });

  it("sends Ctrl+Z to the single history", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    setup({ initial: pdfYaml, onUndo });
    await user.click(screen.getByRole("textbox", { name: "Título" }));
    await user.keyboard("{Control>}z{/Control}");
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("shows the last valid version read-only while the YAML does not parse", () => {
    const onEdit = vi.fn();
    const props = {
      findings: [],
      shared,
      onEdit,
      onUndo: vi.fn(),
      onRedo: vi.fn(),
      onSave: vi.fn(),
      onJumpToLine: vi.fn(),
    };
    const { rerender } = render(<ScenarioForm text={pdfYaml} {...props} />);
    rerender(
      <ScenarioForm
        text={`${pdfYaml}roto: [
`}
        {...props}
      />,
    );
    screen.getByText(/el formulario muestra la última versión válida/);
    const title = screen.getByRole("textbox", { name: "Título" });
    expect(valueOf(title)).toBe("Comprobantes en PDF para un estudio contable");
    expect(title.hasAttribute("readonly")).toBe(true);
    expect(screen.getByRole("combobox", { name: "Nivel" }).hasAttribute("disabled")).toBe(true);
  });

  it("is read-only while the YAML does not parse, with the line of the error", async () => {
    const user = userEvent.setup();
    const onJumpToLine = vi.fn();
    setup({ initial: `${pdfYaml}roto: [\n`, onJumpToLine });
    screen.getByText(/todavía no hay una versión válida/);
    expect(screen.queryByRole("textbox", { name: "Título" })).toBeNull();
    await user.click(screen.getByRole("button", { name: /Ir a la línea/ }));
    expect(onJumpToLine).toHaveBeenCalledWith(expect.any(Number));
  });
});

describe("filterServices", () => {
  it("finds services by id, name or alias, without accents or case", () => {
    const ids = (query: string) => filterServices(shared.catalog, query).map((s) => s.id);
    expect(ids("")).toHaveLength(shared.catalog.length);
    expect(ids("LAMBDA")).toContain("lambda");
    expect(ids("simple storage")).toEqual(["s3"]);
    expect(ids("zzz")).toEqual([]);
  });
});
