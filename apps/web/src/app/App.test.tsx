// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The shell against a bundle served by a fake fetch: redirects, listing, errors and axe.
import type { BundleIndex } from "@blueprint/scenario-schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useContentStore } from "../content/content-store";
import { bundleFiles, fetchFrom } from "../content/testing/bundle-fixture";
import "../i18n";
import { PROGRESS_STORAGE_KEY } from "../progress/local-storage-progress-repository";
import { useProgressStore } from "../progress/progress-store";
import { mockReactFlowLayout } from "../testing/react-flow-mocks";
import { AppRoutes } from "./App";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const serve = (files: Record<string, unknown>) => vi.stubGlobal("fetch", fetchFrom(files));

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  localStorage.clear();
  mockReactFlowLayout();
  serve(bundleFiles(["published", "beta", "draft"]));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("routes", () => {
  it("sends a new player from / to the welcome page", async () => {
    renderAt("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Te damos la bienvenida" }),
    ).toBeTruthy();
  });

  it("sends a player with saved progress from / to the scenarios", async () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        progress: { experience: "beginner", xp: 1200, best: {}, unlocked: [] },
      }),
    );
    renderAt("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Escenarios" })).toBeTruthy();
    // The header shows the rank for 1200 XP (game-rules.yaml), never a player "level".
    expect(await screen.findByText("Constructor")).toBeTruthy();
    expect(screen.queryByText(/Nv\./)).toBeNull();
  });

  it("warns and starts over when the saved progress is corrupt", async () => {
    localStorage.setItem(PROGRESS_STORAGE_KEY, "{broken");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderAt("/");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Te damos la bienvenida" }),
    ).toBeTruthy();
    expect(await screen.findByText(/estaba dañado y se descartó/)).toBeTruthy();
    expect(warn).toHaveBeenCalled();
  });

  it("asks to reload and keeps the progress saved by a newer version of the game", async () => {
    const newer = JSON.stringify({ schemaVersion: 2, progress: { xp: 5000 } });
    localStorage.setItem(PROGRESS_STORAGE_KEY, newer);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderAt("/");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("versión más nueva del juego; recargá la página");
    expect(within(alert).getByRole("button", { name: "Recargar" })).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(newer);
  });

  it("shows a not found page for unknown paths", async () => {
    renderAt("/no-existe");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Página no encontrada" }),
    ).toBeTruthy();
  });
});

describe("scenario listing", () => {
  it("lists the scenarios of the bundle and tags drafts and betas", async () => {
    const index = bundleFiles()["index.json"] as BundleIndex;
    renderAt("/escenarios");
    const cards = await screen.findAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(
      [...index.scenarios].sort((a, b) => a.level - b.level).map((s) => s.title),
    );
    expect(within(cards[1]!).getByText("Beta")).toBeTruthy();
    expect(within(cards[2]!).getByText("Borrador")).toBeTruthy();
    expect(screen.getByText("3 escenarios")).toBeTruthy();
  });

  it("shows a clear error when the bundle does not validate", async () => {
    const files = bundleFiles();
    files["index.json"] = { ...(files["index.json"] as object), scenarios: [{ id: "x" }] };
    serve(files);
    renderAt("/escenarios");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No se pudo cargar el contenido")).toBeTruthy();
    expect(within(alert).getByText("index.json no tiene el formato esperado:")).toBeTruthy();
    expect(within(alert).getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });

  it("has no critical or serious axe violations", async () => {
    const { container } = renderAt("/escenarios");
    await screen.findAllByRole("article");
    const results = await axe.run(container, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations.filter((v) => v.impact === "critical" || v.impact === "serious"),
    ).toEqual([]);
  });
});

describe("scenario page", () => {
  it("loads and validates the scenario, and opens it with its brief", async () => {
    renderAt("/escenarios/serverless-pdf-processing");
    expect(
      await screen.findByRole("dialog", { name: "Comprobantes en PDF para un estudio contable" }),
    ).toBeTruthy();
  });

  it("says so when the scenario is not listed", async () => {
    renderAt("/escenarios/no-existe");
    expect(await screen.findByRole("heading", { name: "Escenario no encontrado" })).toBeTruthy();
  });
});

describe("about page", () => {
  it("shows the licenses, the repository and the non-affiliation notice", async () => {
    renderAt("/acerca");
    await screen.findByRole("heading", { level: 1, name: "Acerca de Blueprint" });
    expect(screen.getByRole("link", { name: /PolyForm Noncommercial 1\.0\.0/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Creative Commons BY-NC-SA 4\.0/ })).toBeTruthy();
    expect(
      screen.getByRole("link", { name: /Ver el repositorio en GitHub/ }).getAttribute("href"),
    ).toBe("https://github.com/elissamburu/blueprint-the-game");
    expect(
      screen.getByText(/No está afiliado, patrocinado ni avalado por Amazon Web Services/),
    ).toBeTruthy();
  });
});
