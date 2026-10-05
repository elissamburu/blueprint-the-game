// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Nuevo escenario" (RF-STU-01): focus on the title, the id that follows it (and "Cambiar id",
// with live validation tied to the field), the request for each source, the title of a copy, the
// server's 409 on the id, and the focus back on the button when closing.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ScenarioSummary } from "../../shared/api";
import { NewScenarioDialog, idProblem } from "./NewScenarioDialog";

const SCENARIOS: ScenarioSummary[] = [
  {
    id: "static-website-https",
    title: "Sitio estático",
    level: 100,
    status: "beta",
    hasErrors: false,
  },
  { id: "sitio-estatico", title: null, level: 100, status: "draft", hasErrors: false },
];

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

function Opened() {
  const location = useLocation();
  return <p data-testid="opened">{`${location.pathname} ${JSON.stringify(location.state)}`}</p>;
}

const renderDialog = () => {
  const router = createMemoryRouter(
    [
      { path: "/", element: <NewScenarioDialog scenarios={SCENARIOS} /> },
      { path: "/escenarios/:id", element: <Opened /> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return userEvent.setup();
};

// jsdom lacks the ResizeObserver Radix measures the radio group with.
class NoResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= NoResizeObserver;
// Nor what Radix Select uses to open its list and show the chosen option.
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const descriptionOf = (element: HTMLElement): string =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const valueOf = (element: HTMLElement): string => (element as HTMLInputElement).value;

/** The folder the dialog says it creates, if it says one. */
const preview = () => document.querySelector("[data-id-preview]")?.textContent;

describe("idProblem", () => {
  it("checks the pattern, the length and the existing ids", () => {
    expect(idProblem("", [])).toBe("required");
    expect(idProblem("Mayus", [])).toBe("pattern");
    expect(idProblem("con--doble", [])).toBe("pattern");
    expect(idProblem("_templates", [])).toBe("pattern");
    expect(idProblem("ab", [])).toBe("length");
    expect(idProblem("a".repeat(65), [])).toBe("length");
    expect(idProblem("static-website-https", ["static-website-https"])).toBe("exists");
    expect(idProblem("mi-escenario", ["static-website-https"])).toBeUndefined();
  });
});

describe("NewScenarioDialog", () => {
  it("starts on the title, the id follows it, and the focus returns on close", async () => {
    const user = renderDialog();
    const open = screen.getByRole("button", { name: "Nuevo escenario" });
    await user.click(open);
    const title = screen.getByRole("textbox", { name: "Título" });
    expect(document.activeElement).toBe(title);
    expect(screen.queryByRole("textbox", { name: "Id" })).toBeNull();

    await user.type(title, "Migración de pagos en Kubernetes");
    expect(preview()).toBe(
      "Se va a crear como content/scenarios/migracion-de-pagos-en-kubernetes/",
    );
    expect(descriptionOf(title)).toContain("content/scenarios/migracion-de-pagos-en-kubernetes/");

    // The id exists already: -2.
    await user.clear(title);
    await user.type(title, "Sitio estático");
    expect(preview()).toBe("Se va a crear como content/scenarios/sitio-estatico-2/");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  it("«Cambiar id» validates the id live and stops following the title", async () => {
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    const title = screen.getByRole("textbox", { name: "Título" });
    await user.type(title, "Colas de pedidos");
    await user.click(screen.getByRole("button", { name: "Cambiar id" }));
    const id = screen.getByRole("textbox", { name: "Id" });
    await waitFor(() => expect(document.activeElement).toBe(id));
    expect(valueOf(id)).toBe("colas-de-pedidos");
    expect(screen.queryByRole("button", { name: "Cambiar id" })).toBeNull();

    await user.clear(id);
    await user.type(id, "Mal");
    expect(id.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(id)).toMatch(/Usá solo minúsculas/);
    expect(preview()).toBeUndefined();

    await user.clear(id);
    await user.type(id, "static-website-https");
    expect(descriptionOf(id)).toMatch(/Ya existe un escenario con ese id/);

    await user.clear(id);
    await user.type(id, "mis-colas");
    expect(id.hasAttribute("aria-invalid")).toBe(false);
    await user.type(title, " grandes");
    expect(valueOf(id)).toBe("mis-colas");
    expect(preview()).toBe("Se va a crear como content/scenarios/mis-colas/");
  });

  it("a title without a valid id disables «Crear» and says why", async () => {
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    const title = screen.getByRole("textbox", { name: "Título" });
    await user.type(title, "¡¿?!");
    const create = screen.getByRole("button", { name: "Crear y abrir" });
    expect((create as HTMLButtonElement).disabled).toBe(true);
    expect(descriptionOf(create)).toMatch(/El título no da un id válido/);
    expect(descriptionOf(title)).toMatch(/El título no da un id válido/);
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(preview()).toBeUndefined();

    await user.type(title, " Hola");
    expect((create as HTMLButtonElement).disabled).toBe(false);
    expect(preview()).toBe("Se va a crear como content/scenarios/hola/");
  });

  it("does not send an incomplete form: the first field with an error gets the focus", async () => {
    const fetch = respond(201, {});
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    const title = screen.getByRole("textbox", { name: "Título" });
    expect(document.activeElement).toBe(title);
    expect(descriptionOf(title)).toBe("Escribí un título.");

    await user.type(title, "Mi escenario");
    await user.click(screen.getByRole("radio", { name: "Duplicar un escenario existente" }));
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: /^Escenario a duplicar/ }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates from the template and opens the editor with the result", async () => {
    const created = { id: "mi-escenario", author: null, generated: [] };
    const fetch = respond(201, created);
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.type(screen.getByRole("textbox", { name: "Título" }), "  Mi escenario ");
    await user.click(screen.getByRole("radio", { name: /^Plantilla comentada/ }));
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));

    await waitFor(() =>
      expect(screen.getByTestId("opened").textContent).toBe(
        `/escenarios/mi-escenario ${JSON.stringify({ created })}`,
      ),
    );
    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("/api/scenarios");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      id: "mi-escenario",
      title: "Mi escenario",
      source: "template",
      from: "scenario",
    });
  });

  it("duplicating suggests «<title> (copia)» and keeps a title written by the author", async () => {
    const fetch = respond(201, { id: "sitio-estatico-copia", author: null, generated: [] });
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.click(screen.getByRole("radio", { name: "Duplicar un escenario existente" }));
    const from = screen.getByRole("combobox", { name: /^Escenario a duplicar/ });
    const choose = async (name: string) => {
      await user.click(from);
      await user.click(await screen.findByRole("option", { name }));
    };
    const title = screen.getByRole("textbox", { name: "Título" });

    expect(from.getAttribute("aria-labelledby")).not.toBeNull();
    await choose("Sitio estático (static-website-https)");
    expect(valueOf(title)).toBe("Sitio estático (copia)");
    expect(
      screen.getByRole("combobox", {
        name: "Escenario a duplicar Sitio estático (static-website-https)",
      }),
    ).toBe(from);
    expect(preview()).toBe("Se va a crear como content/scenarios/sitio-estatico-copia/");

    // Another choice replaces the suggestion (a scenario without a title gives its id)...
    await choose("sitio-estatico");
    expect(valueOf(title)).toBe("sitio-estatico (copia)");
    // ...but not a title the author wrote.
    await user.clear(title);
    await user.type(title, "Mi copia");
    await choose("Sitio estático (static-website-https)");
    expect(valueOf(title)).toBe("Mi copia");

    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [, init] = fetch.mock.calls[0] ?? [];
    expect(JSON.parse(init?.body as string)).toEqual({
      id: "mi-copia",
      title: "Mi copia",
      source: "duplicate",
      from: "static-website-https",
    });
  });

  it("shows the server's 409 on the id field", async () => {
    respond(409, {
      error: { code: "conflict", message: 'Ya existe un escenario con el id "otro-id".' },
    });
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.type(screen.getByRole("textbox", { name: "Título" }), "Otro id");
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    const id = await screen.findByRole("textbox", { name: "Id" });
    await waitFor(() => expect(document.activeElement).toBe(id));
    expect(valueOf(id)).toBe("otro-id");
    expect(descriptionOf(id)).toMatch(/Ya existe un escenario con el id/);
    expect(id.getAttribute("aria-invalid")).toBe("true");
  });
});
