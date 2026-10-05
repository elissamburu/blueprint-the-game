// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The printable version (RF-PLAY-16) through the real routes: its sheets, the solutions only on
// demand, the same gate as the game, and nothing of the game nor of the progress changes.
import { slotNodes } from "@blueprint/game-engine";
import { useSessionStore } from "@blueprint/play";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { useProgressStore } from "../../progress/progress-store";
import { newProgress, storeProgress } from "../../testing/progress-fixture";
import { mockReactFlowLayout } from "../../testing/react-flow-mocks";
import { bundle, pdfScenario } from "./testing/game-fixture";

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  useSessionStore.setState(useSessionStore.getInitialState(), true);
  localStorage.clear();
  mockReactFlowLayout();
  vi.stubGlobal("fetch", fetchFrom(bundleFiles(["published", "published", "published"])));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const slots = slotNodes(pdfScenario);
const serviceName = (id: string) => bundle.catalog.services.find((s) => s.id === id)?.name ?? id;

const openPdf = async () => {
  storeProgress(newProgress("aws-user"));
  renderAt(`/escenarios/${pdfScenario.id}/imprimir`);
  return screen.findByRole("heading", { level: 1, name: pdfScenario.title });
};

const sheet = (name: string) =>
  screen.getByRole("heading", { level: 2, name }).closest("section") as HTMLElement;

describe("printable version", () => {
  it("shows the case and its objectives, then the diagram with the slots numbered and its steps", async () => {
    await openPdf();
    const page = sheet("El caso");
    expect(within(page).getByText("Nivel 200")).toBeTruthy();
    expect(within(page).getByRole("heading", { level: 3, name: "Restricciones" })).toBeTruthy();
    expect(within(page).getByRole("heading", { level: 3, name: "Metas" })).toBeTruthy();
    for (const objective of pdfScenario.objectives) {
      expect(within(page).getByText(objective.text)).toBeTruthy();
    }

    const diagramSheet = sheet("Diagrama para completar");
    const picture = within(diagramSheet).getByRole("img", {
      name: "Diagrama de la arquitectura con los casilleros vacíos numerados",
    });
    // The text alternative of the picture: the steps and the numbered slots.
    const [stepsId, slotsId] = (picture.getAttribute("aria-describedby") ?? "").split(" ");
    const steps = document.getElementById(stepsId ?? "");
    const slotList = document.getElementById(slotsId ?? "");
    expect(steps?.querySelectorAll("li").length).toBe(
      new Set(pdfScenario.diagram.edges.map((e) => e.step)).size,
    );
    expect(steps?.textContent).toContain("→ Casillero 1");
    expect([...(slotList?.querySelectorAll("li") ?? [])].map((li) => li.textContent)).toEqual(
      // The circle with the number (hidden from screen readers), then what they read.
      slots.map((node, i) => `${i + 1}Casillero ${i + 1}: ${node.role}`),
    );
    await waitFor(() => {
      const printed = picture.querySelectorAll('[data-slot="architecture-slot"]');
      expect([...printed].map((s) => s.textContent)).toEqual(slots.map((_, i) => String(i + 1)));
    });
    // A still picture: no control of the board.
    expect(within(picture).queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryByRole("group", { name: "Zoom" })).toBeNull();
    expect(screen.getByRole("button", { name: "Imprimir" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver al escenario" }).getAttribute("href")).toBe(
      `/escenarios/${pdfScenario.id}`,
    );
  });

  it("adds one sheet per slot, in order, only with «Incluir soluciones»", async () => {
    const user = userEvent.setup();
    await openPdf();
    const checkbox = screen.getByRole("checkbox", { name: "Incluir soluciones" });
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("heading", { level: 2, name: "Soluciones" })).toBeNull();

    await user.click(checkbox);
    expect(screen.getByRole("heading", { level: 2, name: "Soluciones" })).toBeTruthy();
    const titles = screen.getAllByRole("heading", { level: 3, name: /^Casillero \d+:/ });
    expect(titles.map((h) => h.textContent?.split(":")[0])).toEqual(
      slots.map((_, i) => `Casillero ${i + 1}`),
    );

    const [first] = slots;
    if (first === undefined) throw new Error("scenario without slots");
    const article = titles[0]?.closest("article") as HTMLElement;
    const optimal = first.answers.find((a) => a.grade === "optimal");
    if (optimal === undefined) throw new Error("slot without optimal");
    const optimalItem = within(article)
      .getByText(serviceName(optimal.service))
      .closest("li") as HTMLElement;
    // Grade by text (and icon), the rationale and the documentation as a visible URL.
    expect(within(optimalItem).getByText("Óptimo")).toBeTruthy();
    expect(optimalItem.textContent).toContain("Por qué:");
    for (const url of optimal.references) {
      expect(within(optimalItem).getByRole("link", { name: new RegExp(url) })).toBeTruthy();
    }
    for (const incorrect of first.incorrect) {
      const item = within(article).getByText(serviceName(incorrect.service)).closest("li");
      expect(item?.getAttribute("data-grade")).toBe("incorrect");
      expect(within(item as HTMLElement).getByText("Incorrecto")).toBeTruthy();
    }
    expect(within(article).getAllByRole("heading", { level: 4 })[0]?.textContent).toBe("Óptimo");

    await user.click(checkbox);
    expect(screen.queryByRole("heading", { level: 2, name: "Soluciones" })).toBeNull();
  });

  it("shows a locked scenario as the game does, without its content", async () => {
    // A beginner has the 300 of networking locked.
    storeProgress({ ...newProgress("beginner"), unlocked: [] });
    renderAt("/escenarios/private-vpc-service-access/imprimir");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario bloqueado" }),
    ).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2, name: "El caso" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Incluir soluciones" })).toBeNull();
  });

  it("says so when the scenario is not listed", async () => {
    storeProgress(newProgress("aws-user"));
    renderAt("/escenarios/no-existe/imprimir");
    expect(await screen.findByText(/no-existe/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Imprimir" })).toBeNull();
  });

  it("sends no command and saves nothing: opening it nor printing changes the session or the progress", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    const dispatch = vi.spyOn(useSessionStore.getState(), "dispatch");
    const session = useSessionStore.getState();
    await openPdf();
    const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);

    await user.click(screen.getByRole("checkbox", { name: "Incluir soluciones" }));
    await user.click(screen.getByRole("button", { name: "Imprimir" }));
    expect(print).toHaveBeenCalledOnce();
    expect(dispatch).not.toHaveBeenCalled();
    expect(useSessionStore.getState()).toBe(session);
    expect(useSessionStore.getState().session).toBeNull();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(stored);
  });

  it("has no axe violations, with the solutions too", async () => {
    const user = userEvent.setup();
    await openPdf();
    await user.click(screen.getByRole("checkbox", { name: "Incluir soluciones" }));
    const results = await axe.run(document.body, {
      resultTypes: ["violations"],
      // jsdom does not compute styles: contrast is checked on the tokens (docs/design).
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
