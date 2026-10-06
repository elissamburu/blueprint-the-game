// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A failed load of the list: "Reintentar" asks again, but with a stale session token (the server
// restarted) the button reloads the page, the only way to get a new token.
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as Reload from "../app/reload";
import { ScenarioListPage } from "./ScenarioListPage";

const reloadPage = vi.hoisted(() => vi.fn());
vi.mock("../app/reload", async (importOriginal) => ({
  ...(await importOriginal<typeof Reload>()),
  reloadPage,
}));

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );

const renderList = () => {
  const router = createMemoryRouter([{ path: "/", element: <ScenarioListPage /> }]);
  render(<RouterProvider router={router} />);
  return userEvent.setup();
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  reloadPage.mockReset();
});

describe("ScenarioListPage, when the list does not load", () => {
  it("with a stale token, offers to reload the page instead of retrying", async () => {
    const fetch = respond(403, {
      error: {
        code: "invalid-token",
        message: "Falta el token de la sesión del Studio o no es válido: recargá la página.",
      },
    });
    const user = renderList();
    const button = await screen.findByRole("button", { name: "Recargar la página" });
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
    await user.click(button);
    expect(reloadPage).toHaveBeenCalledOnce();
    // The same token is not sent again.
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("with another error, retries", async () => {
    const fetch = respond(500, { error: { code: "internal", message: "Algo falló." } });
    const user = renderList();
    await user.click(await screen.findByRole("button", { name: "Reintentar" }));
    expect(reloadPage).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
