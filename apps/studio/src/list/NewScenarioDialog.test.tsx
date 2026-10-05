// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Nuevo escenario" (RF-STU-01): focus on the id, live validation tied to the field, the request
// for each source, the server's 409 on the id, and the focus back on the button when closing.
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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const descriptionOf = (element: HTMLElement): string =>
  (element.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

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
  it("starts on the id, validates it live with the error tied to the field, and returns the focus on close", async () => {
    const user = renderDialog();
    const open = screen.getByRole("button", { name: "Nuevo escenario" });
    await user.click(open);
    const id = screen.getByRole("textbox", { name: "Id" });
    expect(document.activeElement).toBe(id);
    expect(id.hasAttribute("aria-invalid")).toBe(false);

    await user.type(id, "Mal");
    expect(id.getAttribute("aria-invalid")).toBe("true");
    expect(descriptionOf(id)).toMatch(/Usá solo minúsculas/);

    await user.clear(id);
    await user.type(id, "static-website-https");
    expect(descriptionOf(id)).toMatch(/Ya existe un escenario con ese id/);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  it("does not send an incomplete form: the first field with an error gets the focus", async () => {
    const fetch = respond(201, {});
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.type(screen.getByRole("textbox", { name: "Id" }), "mi-escenario");
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    const title = screen.getByRole("textbox", { name: "Título" });
    expect(document.activeElement).toBe(title);
    expect(descriptionOf(title)).toBe("Escribí un título.");

    await user.type(title, "Mi escenario");
    await user.click(screen.getByRole("radio", { name: "Duplicar un escenario existente" }));
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    expect(document.activeElement).toBe(
      screen.getByRole("combobox", { name: "Escenario a duplicar" }),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("creates from the template and opens the editor with the result", async () => {
    const created = { id: "mi-escenario", author: null, generated: [] };
    const fetch = respond(201, created);
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    await user.type(screen.getByRole("textbox", { name: "Id" }), "mi-escenario");
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

  it("shows the server's 409 on the id field", async () => {
    respond(409, {
      error: { code: "conflict", message: 'Ya existe un escenario con el id "otro-id".' },
    });
    const user = renderDialog();
    await user.click(screen.getByRole("button", { name: "Nuevo escenario" }));
    const id = screen.getByRole("textbox", { name: "Id" });
    await user.type(id, "otro-id");
    await user.type(screen.getByRole("textbox", { name: "Título" }), "Otro");
    await user.click(screen.getByRole("button", { name: "Crear y abrir" }));
    await waitFor(() => expect(descriptionOf(id)).toMatch(/Ya existe un escenario con el id/));
    expect(document.activeElement).toBe(id);
    expect(id.getAttribute("aria-invalid")).toBe("true");
  });
});
