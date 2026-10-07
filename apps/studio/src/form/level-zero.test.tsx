// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Level 0 in the form (RF-STU-19, ADR-0027 §6): the service picker lists concepts with the text
// «Concepto», their glyph and a name that says it, and finds by plain name; every answer has
// «Dónde se rompe la analogía», required at level 0 with the L021 issue tied to it; and a text
// with a maximum length announces its count only near the limit.
import { CatalogEntrySchema } from "@blueprint/scenario-schema";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SharedContent } from "../../shared/api";
import { planEdits } from "../../shared/document-edit";
import type { StudioFinding } from "../../shared/validation";
import { pdfYaml, shared } from "../testing/content-fixture";
import { ScenarioForm, type ScenarioFormHandle } from "./ScenarioForm";
import { filterServices } from "./ServicePicker";

afterEach(cleanup);

// jsdom has no ResizeObserver, nor what Radix Select uses to open its list.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoResizeObserver;
const SELECT_STUBS = {
  hasPointerCapture: () => false,
  releasePointerCapture: () => undefined,
  scrollIntoView: () => undefined,
};
for (const [name, value] of Object.entries(SELECT_STUBS)) {
  if (!(name in Element.prototype)) {
    Object.defineProperty(Element.prototype, name, { value, configurable: true });
  }
}

const REGION = CatalogEntrySchema.parse({
  type: "concept",
  id: "region",
  name: "Región de AWS",
  plainName: "Lugar del mundo",
  category: "concept-global-infrastructure",
  leakPatterns: ["Región de AWS"],
  short: "Área geográfica con varias zonas de disponibilidad.",
  docs: "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/global-infrastructure.html",
  glyph: "region",
  status: "active",
});

// The real catalog already has concepts: these tests build their own catalogs so they do not
// depend on the content.
const withoutConcepts: SharedContent = {
  ...shared,
  catalog: shared.catalog.filter((entry) => entry.type !== "concept"),
};

const withConcepts: SharedContent = {
  ...withoutConcepts,
  catalog: [
    ...withoutConcepts.catalog.map((entry) =>
      entry.id === "s3" ? { ...entry, plainName: "Almacenamiento de archivos" } : entry,
    ),
    REGION,
  ],
};

const levelZeroYaml = pdfYaml.replace("level: 200", "level: 0");
/** The first answer of the first slot of the 200 scenario (api-entry). */
const ANSWER = ["diagram", "nodes", 2, "answers", 0] as const;
const FIRST_REFERENCE =
  "            - https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html\n";

interface HarnessHandle {
  form: () => ScenarioFormHandle | null;
  text: string;
}

function Harness({
  initial,
  content,
  findings,
  ref,
}: {
  initial: string;
  content: SharedContent;
  findings: StudioFinding[];
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
      shared={content}
      onEdit={(commands) => setText((current) => planEdits(current, commands).text)}
      onUndo={vi.fn()}
      onRedo={vi.fn()}
      onSave={vi.fn()}
      onJumpToLine={vi.fn()}
    />
  );
}

const setup = ({
  initial,
  content = shared,
  findings = [],
}: {
  initial: string;
  content?: SharedContent;
  findings?: StudioFinding[];
}) => {
  const handle: { current: HarnessHandle | null } = { current: null };
  render(
    <Harness
      initial={initial}
      content={content}
      findings={findings}
      ref={(value) => void (handle.current = value)}
    />,
  );
  const get = () => {
    if (handle.current === null) throw new Error("no harness");
    return handle.current;
  };
  return { text: () => get().text, form: () => get().form() };
};

const descriptionOf = (element: HTMLElement): string =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const l021: StudioFinding = {
  code: "L021",
  severity: "error",
  message: "No tiene analogyLimit.",
  where: "diagram.nodes[2].answers[0]",
  path: [...ANSWER],
  line: 1,
  column: 1,
};

const openFirstSlot = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: "Casilleros" }));
  await user.click(screen.getByRole("button", { name: /^Casillero 1:/ }));
};

const TEXT_NAME = "Texto de «Dónde se rompe la analogía» de la respuesta 1 del casillero 1";

describe("service picker with concepts", () => {
  it("shows a concept with the text «Concepto», its glyph and a name that says it", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml, content: withConcepts });
    await openFirstSlot(user);
    await user.click(
      screen.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 1/ }),
    );
    const search = screen.getByRole("combobox", { name: "Buscar servicio o concepto" });
    const list = screen.getByRole("listbox", { name: "Servicios y conceptos del catálogo" });

    await user.type(search, "LUGAR del mundo");
    const region = within(list).getByRole("option", {
      name: "Región de AWS, concepto, Lugar del mundo (region)",
    });
    expect(within(list).getAllByRole("option")).toHaveLength(1);
    expect(region.textContent).toContain("Concepto");
    expect(region.querySelector('[data-glyph="region"]')).not.toBeNull();

    await user.clear(search);
    await user.type(search, "almacenamiento de ARCHIVOS");
    const s3 = within(list).getByRole("option");
    expect(s3.textContent).toContain("Amazon S3");
    expect(s3.textContent).toContain("Almacenamiento de archivos");
    expect(s3.textContent).not.toContain("Concepto");

    await user.clear(search);
    await user.type(search, "lugar{Enter}");
    expect(text()).toContain("        - service: region\n");
    screen.getByRole("button", {
      name: "Servicio de la respuesta 1 del casillero 1 Región de AWS (region) · concepto",
    });
  });

  it("keeps the names of a catalog without concepts", async () => {
    const user = userEvent.setup();
    setup({ initial: pdfYaml, content: withoutConcepts });
    await openFirstSlot(user);
    await user.click(
      screen.getByRole("button", { name: /^Servicio de la respuesta 1 del casillero 1/ }),
    );
    screen.getByRole("combobox", { name: "Buscar servicio" });
    screen.getByRole("listbox", { name: "Servicios del catálogo" });
  });
});

describe("filterServices with plain names", () => {
  it("finds by plain name too, without accents or case", () => {
    const ids = (query: string) => filterServices(withConcepts.catalog, query).map((s) => s.id);
    expect(ids("lugar DEL mundo")).toEqual(["region"]);
    expect(ids("región")).toContain("region");
    expect(ids("almacenamiento archivos")).toEqual(["s3"]);
  });
});

describe("level 0 in the form", () => {
  it("shows level 0 as «0 · Ideas básicas de la nube»", () => {
    setup({ initial: levelZeroYaml });
    expect(screen.getByRole("combobox", { name: "Nivel" }).textContent).toBe(
      "0 · Ideas básicas de la nube",
    );
  });

  it("checks «fundamentos» when a scenario without areas becomes level 0", async () => {
    const user = userEvent.setup();
    const noAreas = pdfYaml.replace("areas: [serverless, storage, integration]", "areas: []");
    const { text } = setup({ initial: noAreas });
    await user.click(screen.getByRole("combobox", { name: "Nivel" }));
    await user.click(await screen.findByRole("option", { name: "0 · Ideas básicas de la nube" }));
    expect(text()).toBe(noAreas.replace("level: 200\nareas: []", "level: 0\nareas: [fundamentos]"));
    screen.getByText(
      "Se marcó el área «Fundamentos de la nube», la de todo escenario de nivel 0. Podés desmarcarla.",
    );
    const fundamentos = screen.getByRole("checkbox", { name: /^fundamentos/ });
    expect(fundamentos.getAttribute("aria-checked")).toBe("true");
    await user.click(fundamentos);
    expect(text()).toBe(noAreas.replace("level: 200", "level: 0"));
  });

  it("leaves the areas as they are when the scenario already has some", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml });
    await user.click(screen.getByRole("combobox", { name: "Nivel" }));
    await user.click(await screen.findByRole("option", { name: "0 · Ideas básicas de la nube" }));
    expect(text()).toBe(levelZeroYaml);
  });

  it("marks «Dónde se rompe la analogía» as required, with the L021 issue tied to it", async () => {
    const user = userEvent.setup();
    const { form } = setup({ initial: levelZeroYaml, findings: [l021] });
    act(() => {
      expect(form()?.focusPath([...ANSWER, "analogyLimit"])).toBe(true);
    });
    const group = screen.getByRole("group", {
      name: "Dónde se rompe la analogía de la respuesta 1 del casillero 1 (obligatorio en el nivel 0)",
    });
    expect(document.activeElement).toBe(group);
    expect(descriptionOf(group)).toContain("En el nivel 0, cada respuesta dice dónde");
    expect(descriptionOf(group)).toContain("Error L021: No tiene analogyLimit.");
    const add = within(group).getByRole("button", {
      name: "Agregar «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
    });
    expect(descriptionOf(add)).toContain("Error L021: No tiene analogyLimit.");

    await user.click(add);
    const field = screen.getByRole("textbox", { name: TEXT_NAME });
    expect(document.activeElement).toBe(field);
    expect(field.getAttribute("aria-required")).toBe("true");
  });
});

describe("«Dónde se rompe la analogía»", () => {
  it("is optional at other levels; adding, editing and removing it edit the YAML", async () => {
    const user = userEvent.setup();
    const { text } = setup({ initial: pdfYaml });
    await openFirstSlot(user);
    const group = screen.getByRole("group", {
      name: "Dónde se rompe la analogía de la respuesta 1 del casillero 1",
    });
    within(group).getByText(/^Opcional:/);

    await user.click(within(group).getByRole("button", { name: /^Agregar «Dónde se rompe/ }));
    expect(text()).toBe(
      pdfYaml.replace(
        FIRST_REFERENCE,
        `${FIRST_REFERENCE}          analogyLimit:\n            text: ""\n            references:\n              - ""\n`,
      ),
    );
    screen.getByText("Se agregó «Dónde se rompe la analogía» de la respuesta 1 del casillero 1.");

    const field = screen.getByRole("textbox", { name: TEXT_NAME });
    expect(document.activeElement).toBe(field);
    await user.type(field, "Una ciudad");
    expect(text()).toContain('            text: "Una ciudad"\n');
    expect(descriptionOf(field)).toBe("10 de 300 caracteres");
    // Emptying the text keeps the key: only «Quitar» removes it.
    await user.clear(field);
    expect(text()).toContain('          analogyLimit:\n            text: ""\n');

    await user.type(
      screen.getByRole("textbox", {
        name: "Referencia 1 de «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
      }),
      "https://docs.aws.amazon.com/a",
    );
    expect(text()).toContain('              - "https://docs.aws.amazon.com/a"\n');
    await user.click(
      screen.getByRole("button", {
        name: "Agregar referencia de «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
      }),
    );
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", {
        name: "Referencia 2 de «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
      }),
    );

    await user.click(
      screen.getByRole("button", {
        name: "Quitar «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
      }),
    );
    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Vaciar el texto no lo quita.");
    await user.click(within(dialog).getByRole("button", { name: "Quitar" }));
    expect(text()).toBe(pdfYaml);
    expect(document.activeElement).toBe(
      screen.getByRole("button", {
        name: "Agregar «Dónde se rompe la analogía» de la respuesta 1 del casillero 1",
      }),
    );
    screen.getByText("Se quitó «Dónde se rompe la analogía» de la respuesta 1 del casillero 1.");
  });

  it("announces the count of characters only when it crosses a step near the limit", async () => {
    const user = userEvent.setup();
    const filled = pdfYaml.replace(
      FIRST_REFERENCE,
      `${FIRST_REFERENCE}          analogyLimit:\n            text: "${"a".repeat(245)}"\n            references:\n              - https://docs.aws.amazon.com/a\n`,
    );
    setup({ initial: filled });
    await openFirstSlot(user);
    const field = screen.getByRole("textbox", { name: TEXT_NAME });
    // The status region of the form, the only one.
    const count = screen.getByRole("status");

    expect(count.textContent).toBe("");
    await user.type(field, "aaaa");
    expect(count.textContent).toBe("");
    await user.type(field, "a");
    expect(count.textContent).toBe("Quedan 50 caracteres de 300.");
    // Within the same step, a key does not change the announcement.
    await user.type(field, "aaaa");
    expect(count.textContent).toBe("Quedan 50 caracteres de 300.");
    expect(descriptionOf(field)).toBe("254 de 300 caracteres");
    await user.type(field, "a".repeat(26));
    expect(count.textContent).toBe("Quedan 20 caracteres de 300.");
    await user.type(field, "a".repeat(21));
    expect(count.textContent).toBe("Sobra 1 carácter: el máximo es 300.");
    expect(descriptionOf(field)).toBe("301 de 300 caracteres: 1 de más");
  });
});
