// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game screen through the real routes, against the content bundle served by a fake fetch.
import { slotNodes } from "@blueprint/game-engine";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
import { mockReactFlowLayout } from "../../testing/react-flow-mocks";
import { bundle, pdfScenario, slotOf } from "./testing/game-fixture";

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  localStorage.clear();
  // Stubbed per test: afterEach unstubs every global.
  mockReactFlowLayout();
  vi.stubGlobal("fetch", fetchFrom(bundleFiles(["published", "published", "published"])));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TITLE = "Comprobantes en PDF para un estudio contable";

const open = async () => {
  // React Flow leaves nodes without pointer events until it measures them, which jsdom never does.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <MemoryRouter initialEntries={[`/escenarios/${pdfScenario.id}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: TITLE });
  return user;
};

const slotButton = (slotId: string) => {
  const button = document.querySelector<HTMLButtonElement>(
    `[data-slot-id="${slotId}"] [data-slot="architecture-slot-main"]`,
  );
  if (button === null) throw new Error(`no slot ${slotId}`);
  return button;
};

/**
 * Activates a control inside the board with the keyboard. A pointer click there reaches
 * d3-zoom, which needs `event.view`, and jsdom mouse events from user-event have none.
 */
const press = async (user: ReturnType<typeof userEvent.setup>, element: HTMLElement) => {
  element.focus();
  await user.keyboard("{Enter}");
};

const paletteButton = (serviceId: string) => {
  const button = document.querySelector<HTMLButtonElement>(`[data-palette-service="${serviceId}"]`);
  if (button === null) throw new Error(`no palette service ${serviceId}`);
  return button;
};

const feedback = () =>
  screen.getByRole("region", { name: /Explicación|Óptimo|Aceptable|Incorrecto/ });
const role = (slotId: string) => slotOf(pdfScenario, slotId).role;

const withProgress = () =>
  localStorage.setItem(
    PROGRESS_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 1,
      progress: { experience: "beginner", xp: 0, best: {}, unlocked: [] },
    }),
  );

describe("game screen layout", () => {
  it("shows the top bar, the case with restrictions apart from goals, the board and the palette", async () => {
    await open();
    const slots = slotNodes(pdfScenario).length;
    expect(screen.getByText(`0 de ${slots} casilleros`)).toBeTruthy();
    expect(screen.getByText("Puntaje")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finalizar" }).hasAttribute("disabled")).toBe(true);

    const caseAside = screen.getByRole("complementary", { name: "El caso" });
    const restrictions = within(caseAside).getByRole("heading", { name: "Restricciones" });
    const goals = within(caseAside).getByRole("heading", { name: "Metas" });
    const hard = pdfScenario.objectives.filter((o) => o.kind === "hard").map((o) => o.text);
    const soft = pdfScenario.objectives.filter((o) => o.kind === "soft").map((o) => o.text);
    const listOf = (heading: HTMLElement) =>
      [...(heading.closest("section")?.querySelectorAll("li") ?? [])].map((li) => li.textContent);
    expect(listOf(restrictions)).toEqual(hard);
    expect(listOf(goals)).toEqual(soft);

    const palette = screen.getByRole("complementary", { name: "Paleta de servicios" });
    expect(within(palette).getByRole("searchbox", { name: "Buscar servicio" })).toBeTruthy();
    expect(within(palette).getAllByRole("button", { expanded: true }).length).toBeGreaterThan(1);

    const live = document.querySelector("[aria-live=polite][data-status]");
    expect(live?.textContent).toContain("Colocá un servicio para ver la explicación.");
  });

  it("links the report form prefilled with the scenario and the selected slot", async () => {
    const user = await open();
    const report = () => screen.getByRole("link", { name: /Reportar un problema/ });
    const params = () => new URL(report().getAttribute("href") ?? "").searchParams;
    expect(params().get("template")).toBe("error-en-escenario.yml");
    expect(params().get("scenario")).toBe(pdfScenario.id);
    expect(params().get("version")).toBe(String(pdfScenario.version));
    expect(params().has("slot")).toBe(false);
    await press(user, slotButton("upload-store"));
    expect(params().get("slot")).toBe("upload-store");
  });

  it("has no critical or serious axe violations", async () => {
    await open();
    const results = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(
      results.violations
        .filter((v) => v.impact === "critical" || v.impact === "serious")
        .map((v) => v.id),
    ).toEqual([]);
  });
});

describe("game screen keyboard adapters", () => {
  it("slot first: Enter on a slot, search, Enter places it and returns the focus", async () => {
    const user = await open();
    slotButton("upload-store").focus();
    await user.keyboard("{Enter}");
    const search = screen.getByRole("searchbox", { name: "Buscar servicio" });
    expect(document.activeElement).toBe(search);
    expect(slotButton("upload-store").getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("Simple Storage{Enter}");
    expect(document.activeElement).toBe(slotButton("upload-store"));
    expect(slotButton("upload-store").getAttribute("aria-label")).toContain("Óptimo: Amazon S3");
    expect(feedback().textContent).toContain(`Amazon S3 en «${role("upload-store")}»: Óptimo.`);
    expect(screen.getByText(`1 de ${slotNodes(pdfScenario).length} casilleros`)).toBeTruthy();
  });

  it("service first: choose a service, then activate the slot", async () => {
    const user = await open();
    await user.click(paletteButton("ebs"));
    expect(paletteButton("ebs").getAttribute("aria-pressed")).toBe("true");
    slotButton("upload-store").focus();
    await user.keyboard("{Enter}");
    expect(slotButton("upload-store").getAttribute("aria-label")).toContain(
      "Incorrecto: Amazon EBS",
    );
    expect(paletteButton("ebs").getAttribute("aria-pressed")).toBe("false");
    expect(within(feedback()).getByText(/Viola:/)).toBeTruthy();
  });

  it("Esc cancels the selection", async () => {
    const user = await open();
    await press(user, slotButton("upload-store"));
    expect(slotButton("upload-store").getAttribute("aria-pressed")).toBe("true");
    await user.keyboard("{Escape}");
    expect(slotButton("upload-store").getAttribute("aria-pressed")).toBe("false");
    expect(feedback().textContent).toContain("Selección cancelada.");
  });

  it('"Probar otra" empties the slot and selects it for the next service', async () => {
    const user = await open();
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("alb"));
    await user.click(within(feedback()).getByRole("button", { name: "Probar otra" }));
    expect(slotButton("api-entry").getAttribute("aria-label")).toContain("Vacío");
    expect(slotButton("api-entry").getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
  });

  it("hints: the slot button reveals one and costs points once the slot is solved", async () => {
    const user = await open();
    const hints = slotOf(pdfScenario, "api-entry").hints;
    const cost = bundle.rules.scoring.hintCost;
    const slot = slotButton("api-entry").closest<HTMLElement>("[data-slot=architecture-slot]");
    if (slot === null) throw new Error("no slot");
    await press(user, within(slot).getByRole("button", { name: `Ver pista (−${cost} pts)` }));
    const popover = await screen.findByRole("dialog");
    expect(popover.textContent).toContain(hints[0]);
    await user.keyboard("{Escape}");
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("apigateway"));
    expect(screen.getByText(String(bundle.rules.scoring.firstTryGreen - cost))).toBeTruthy();
  });
});

describe("finishing", () => {
  const solveAll = async (user: ReturnType<typeof userEvent.setup>) => {
    for (const node of slotNodes(pdfScenario)) {
      const optimal = node.answers.find((a) => a.grade === "optimal");
      if (optimal === undefined) throw new Error("slot without optimal");
      await press(user, slotButton(node.id));
      await user.click(paletteButton(optimal.service));
    }
  };

  it("saves the progress, toasts the XP and opens the summary", async () => {
    withProgress();
    const user = await open();
    const finish = screen.getByRole("button", { name: "Finalizar" });
    await solveAll(user);
    await waitFor(() => expect(finish.hasAttribute("disabled")).toBe(false));
    await act(() => user.click(finish));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeTruthy();
    const slots = slotNodes(pdfScenario).length;
    const score = slots * bundle.rules.scoring.firstTryGreen;
    const xp = Math.round(score * bundle.rules.levelMultipliers["200"]);
    expect(screen.getByText(`${score} de ${score}`)).toBeTruthy();
    expect(screen.getByText(`${xp} XP (+${xp} a tu total)`)).toBeTruthy();
    expect(await screen.findByText(`+${xp} XP (total: ${xp} XP)`)).toBeTruthy();
    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "{}") as {
      progress?: { xp?: number };
    };
    expect(stored.progress?.xp).toBe(xp);
  });

  it("without progress, plays anyway and warns that the result is not saved", async () => {
    const user = await open();
    await solveAll(user);
    await act(() => user.click(screen.getByRole("button", { name: "Finalizar" })));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeTruthy();
    expect(screen.getByText(/XP \(no se guardó\)/)).toBeTruthy();
    expect(
      await screen.findByText(
        "Tu resultado no se guarda hasta que completes la configuración inicial.",
      ),
    ).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });
});
