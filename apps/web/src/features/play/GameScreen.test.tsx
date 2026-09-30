// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game screen through the real routes, against the content bundle served by a fake fetch.
import { createProgress, slotNodes } from "@blueprint/game-engine";
import type { Experience } from "@blueprint/scenario-schema";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { formatNumber } from "../../i18n/format";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { PALETTE_COLLAPSED_KEY } from "./ui-preferences";
import { PROGRESS_SCHEMA_VERSION } from "../../progress/progress-schema";
import { storedProgress } from "../../testing/progress-fixture";
import { useProgressStore } from "../../progress/progress-store";
import { mockReactFlowLayout } from "../../testing/react-flow-mocks";
import { bundle, pdfScenario, slotOf, staticWebsiteScenario } from "./testing/game-fixture";

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

const open = async (scenarioId = pdfScenario.id, options: { closeBrief?: boolean } = {}) => {
  // React Flow leaves nodes without pointer events until it measures them, which jsdom never does.
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(
    <MemoryRouter initialEntries={[`/escenarios/${scenarioId}`]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  const scenario = scenarioId === pdfScenario.id ? pdfScenario : staticWebsiteScenario;
  // The brief opens first; "Empezar a diseñar" leaves the board.
  const brief = await screen.findByRole("dialog", { name: scenario.title });
  if (options.closeBrief !== false) {
    await user.click(within(brief).getByRole("button", { name: /Empezar a diseñar/ }));
    await screen.findByRole("heading", { level: 1, name: scenario.title });
  }
  // React Flow draws the nodes once it has measured the board.
  await waitFor(() =>
    expect(document.querySelector("[data-slot=board-area] [data-slot-id]")).not.toBeNull(),
  );
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

const feedback = () => screen.getByRole("region", { name: /Óptimo|Aceptable|Incorrecto/ });
/** The live region of the screen (announcements and the feedback card). */
const live = () => {
  const layer = document.querySelector<HTMLElement>("[data-slot=feedback-layer]");
  if (layer === null) throw new Error("no live region");
  return layer;
};
const role = (slotId: string) => slotOf(pdfScenario, slotId).role;
/** The role as the steps name a slot: without its final period. */
const roleOf = (scenario: typeof pdfScenario, slotId: string) =>
  slotOf(scenario, slotId).role.replace(/\.+$/, "");

/** A stored player who opened levels 100 and 200 (the PDF scenario is level 200). */
const withProgress = (experience: Experience = "aws-user") =>
  localStorage.setItem(
    PROGRESS_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      progress: createProgress(
        { experience, interests: ["serverless"] },
        bundle.index.scenarios,
        bundle.rules,
      ),
    }),
  );

describe("access", () => {
  it("shows why a locked scenario cannot be played, instead of its brief", async () => {
    withProgress("beginner");
    render(
      <MemoryRouter initialEntries={[`/escenarios/${pdfScenario.id}`]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario bloqueado" }),
    ).toBeTruthy();
    expect(screen.getByText("Completá escenarios de nivel 100 en Almacenamiento.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("link", { name: "Volver a escenarios" })).toBeTruthy();
    const results = await axe.run(document.body, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it("marks the scenario as started with the first placement", async () => {
    withProgress();
    const user = await open();
    const slot = slotNodes(pdfScenario)[0];
    if (slot === undefined) throw new Error("no slots");
    await press(user, slotButton(slot.id));
    await user.click(paletteButton(slot.answers[0]?.service ?? ""));
    await waitFor(() => expect(storedProgress()?.started).toEqual([pdfScenario.id]));
  });
});

describe("game screen layout", () => {
  it("replaces the global header with the game bar: progress, score, actions and menu", async () => {
    await open();
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    const slots = slotNodes(pdfScenario).length;
    expect(screen.getByText(`0 de ${slots} casilleros`)).toBeTruthy();
    expect(screen.getByText("Puntaje")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver a escenarios" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver caso" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Modo foco" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finalizar" }).getAttribute("aria-disabled")).toBe(
      "true",
    );

    const palette = screen.getByRole("complementary", { name: "Paleta de servicios" });
    expect(within(palette).getByRole("searchbox", { name: "Buscar servicio" })).toBeTruthy();
    expect(within(palette).getAllByRole("button", { expanded: true }).length).toBeGreaterThan(1);
    // No feedback until there is something to explain.
    expect(screen.queryByRole("region", { name: /Óptimo|Aceptable|Incorrecto/ })).toBeNull();
    expect(live().getAttribute("aria-live")).toBe("polite");
  });

  it("brings the global header back when leaving the game", async () => {
    const user = await open();
    await user.click(screen.getByRole("link", { name: "Volver a escenarios" }));
    expect(await screen.findByRole("navigation", { name: "Principal" })).toBeTruthy();
  });

  it('"⋯" links the report form with the scenario and the slot', async () => {
    const user = await open();
    const reportHref = async () => {
      await user.click(screen.getByRole("button", { name: "Más acciones" }));
      const menu = await screen.findByRole("menu");
      const link = within(menu).getByRole("menuitem", { name: /Reportar un problema/ });
      const href = new URL(link.getAttribute("href") ?? "");
      await user.keyboard("{Escape}");
      return href.searchParams;
    };
    let params = await reportHref();
    expect(params.get("template")).toBe("error-en-escenario.yml");
    expect(params.get("scenario")).toBe(pdfScenario.id);
    expect(params.get("version")).toBe(String(pdfScenario.version));
    expect(params.has("slot")).toBe(false);
    await press(user, slotButton("upload-store"));
    params = await reportHref();
    expect(params.get("slot")).toBe("upload-store");
  });

  it('"Reproducir flujo" is a button of the bar with visible text, not a menu item', async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).queryByRole("menuitem", { name: "Reproducir flujo" })).toBeNull();
    await user.keyboard("{Escape}");

    const play = screen.getByRole("button", { name: "Reproducir flujo" });
    expect(play.closest("header")).not.toBeNull();
    // The name is the visible text, not a hidden label.
    expect(play.textContent).toBe("Reproducir flujo");
    expect(play.querySelector(".sr-only")).toBeNull();
    await user.click(play);
    expect(await screen.findByRole("group", { name: "Reproductor de flujo" })).toBeTruthy();
    expect(document.querySelector("[data-slot=diagram] p[aria-live]")?.textContent).toMatch(
      /^Paso 1 de /,
    );
  });

  const violations = async () => {
    const results = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    return results.violations.map(
      (v) => `${v.id} (${v.impact ?? "?"}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
    );
  };

  it("has no axe violations with the brief, the board, a feedback and the case", async () => {
    const user = await open(pdfScenario.id, { closeBrief: false });
    expect(await violations()).toEqual([]);
    await user.click(screen.getByRole("button", { name: /Empezar a diseñar/ }));
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("alb"));
    expect(await violations()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Ver caso" }));
    await screen.findByRole("dialog");
    expect(await violations()).toEqual([]);
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
    expect(live().textContent).toContain(`Amazon S3 en «${role("upload-store")}»: Óptimo.`);
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
    expect(live().textContent).toContain("Selección cancelada.");
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

  it("saves the progress and opens the summary, which shows the XP instead of a toast", async () => {
    withProgress();
    const user = await open();
    const finish = screen.getByRole("button", { name: "Finalizar" });
    await solveAll(user);
    await waitFor(() => expect(finish.getAttribute("aria-disabled")).toBe("false"));
    expect(finish.getAttribute("aria-describedby")).toBeNull();
    await act(() => user.click(finish));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeTruthy();
    const slots = slotNodes(pdfScenario).length;
    const score = slots * bundle.rules.scoring.firstTryGreen;
    const xp = Math.round(score * bundle.rules.levelMultipliers["200"]);
    const figures = await screen.findByRole("region", { name: "Resultado" });
    expect(within(figures).getByText(String(score))).toBeTruthy();
    expect(within(figures).getByText(`de ${score}`)).toBeTruthy();
    expect(within(figures).getByText(`+${formatNumber(xp)}`)).toBeTruthy();
    expect(screen.queryByText(/XP \(total:/)).toBeNull();
    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "{}") as {
      progress?: { xp?: number };
    };
    expect(stored.progress?.xp).toBe(xp);
  });

  it("«Finalizar» stays focusable while slots are missing and says how many, also by keyboard", async () => {
    withProgress();
    const user = await open();
    const finish = screen.getByRole("button", { name: "Finalizar" });
    const slots = slotNodes(pdfScenario);
    const describedBy = () =>
      document.getElementById(finish.getAttribute("aria-describedby") ?? "")?.textContent;
    expect(finish.hasAttribute("disabled")).toBe(false);
    expect(finish.getAttribute("aria-disabled")).toBe("true");
    expect(describedBy()).toBe(`Faltan ${slots.length} casilleros`);

    finish.focus();
    expect(document.activeElement).toBe(finish);
    // Enter and Space do nothing yet: the game stays open.
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(screen.getByRole("heading", { level: 1, name: pdfScenario.title })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Escenario completado" })).toBeNull();

    // One slot solved: one less.
    const first = slots[0];
    const optimal = first?.answers.find((a) => a.grade === "optimal");
    if (first === undefined || optimal === undefined) throw new Error("no optimal answer");
    await press(user, slotButton(first.id));
    await user.click(paletteButton(optimal.service));
    await waitFor(() => expect(describedBy()).toBe(`Faltan ${slots.length - 1} casilleros`));
  });

  it("without progress, plays anyway and warns that the result is not saved", async () => {
    const user = await open();
    await solveAll(user);
    await act(() => user.click(screen.getByRole("button", { name: "Finalizar" })));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeTruthy();
    expect(screen.getByText("No se guardó")).toBeTruthy();
    expect(
      screen.getByText(
        "Tu resultado no se guardó porque todavía no hiciste la configuración inicial.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Hacer la configuración inicial" }).getAttribute("href"),
    ).toBe("/bienvenida");
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });
});

describe('"Ver solución" (RF-PLAY-14)', () => {
  const menuItem = async (user: ReturnType<typeof userEvent.setup>, name: string | RegExp) => {
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    return within(await screen.findByRole("menu")).getByRole("menuitem", { name });
  };
  const slotBox = (slotId: string) => {
    const box = slotButton(slotId).closest<HTMLElement>("[data-slot=architecture-slot]");
    if (box === null) throw new Error(`no slot ${slotId}`);
    return box;
  };
  /** Live announcements (not the card), to check each one is said once. */
  const announcements = () =>
    [...live().querySelectorAll(":scope > p.sr-only")].map((p) => p.textContent);
  const violations = async () =>
    (await axe.run(document.body, { rules: { "color-contrast": { enabled: false } } })).violations;

  it("needs an unresolved slot, asks first inviting to a hint, and Cancelar changes nothing", async () => {
    const user = await open();
    const unavailable = await menuItem(user, /Ver solución de este casillero/);
    expect(unavailable.getAttribute("aria-disabled")).toBe("true");
    expect(unavailable.textContent).toContain("Elegí un casillero sin resolver");
    expect(await violations()).toEqual([]);
    await user.keyboard("{Escape}");

    await press(user, slotButton("api-entry"));
    const item = await menuItem(user, "Ver solución de este casillero");
    expect(item.getAttribute("aria-disabled")).toBeNull();
    await user.click(item);
    const notice = await screen.findByRole("alertdialog", {
      name: "¿Ver la solución de este casillero?",
    });
    expect(notice.textContent).toContain(
      "¿Querés probar con una pista primero? Si preferís ver la solución, este casillero no suma puntos, pero podés terminar el escenario igual.",
    );
    expect(notice.textContent).toContain(role("api-entry"));
    for (const name of ["Cancelar", "Usar una pista", "Ver solución"]) {
      expect(within(notice).getByRole("button", { name })).toBeTruthy();
    }
    expect(await violations()).toEqual([]);

    await user.click(within(notice).getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Más acciones" })),
    );
    expect(slotBox("api-entry").dataset.grade).toBe("empty");
  });

  it("shows the solution after an error as «Solución vista», with its explanation and 0 points", async () => {
    const user = await open();
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("route53"));
    expect(slotBox("api-entry").dataset.grade).toBe("incorrect");
    // The selection was released, but the slot with the feedback is the target.
    await user.click(await menuItem(user, "Ver solución de este casillero"));
    const notice = await screen.findByRole("alertdialog");
    await user.click(within(notice).getByRole("button", { name: "Ver solución" }));

    const optimal = slotOf(pdfScenario, "api-entry").answers.find((a) => a.grade === "optimal");
    const serviceName = bundle.catalog.services.find((s) => s.id === optimal?.service)?.name ?? "";
    await waitFor(() => expect(slotBox("api-entry").dataset.grade).toBe("revealed"));
    expect(slotButton("api-entry").getAttribute("aria-label")).toBe(
      `${roleOf(pdfScenario, "api-entry")}. Solución vista: ${serviceName}`,
    );
    const card = screen.getByRole("region", { name: /Solución vista/ });
    expect(card.textContent).toContain("No suma puntos");
    expect(card.textContent).toContain(optimal?.rationale.slice(0, 20) ?? "");
    expect(within(card).queryByRole("button", { name: "Probar otra" })).toBeNull();
    expect(announcements()).toEqual([
      `Solución de «${role("api-entry")}»: ${serviceName}. No suma puntos.`,
    ]);
    await waitFor(() => expect(document.activeElement).toBe(slotButton("api-entry")));
    expect(screen.getByText("0", { selector: "strong" })).toBeTruthy();
    expect(await violations()).toEqual([]);

    // Solved now: the option is off for it.
    const again = await menuItem(user, /Ver solución de este casillero/);
    expect(again.getAttribute("aria-disabled")).toBe("true");
  });

  it("«Usar una pista» reveals a hint instead and leaves the focus on the hints of the slot", async () => {
    const user = await open();
    await press(user, slotButton("api-entry"));
    await user.click(await menuItem(user, "Ver solución de este casillero"));
    const notice = await screen.findByRole("alertdialog");
    await user.click(within(notice).getByRole("button", { name: "Usar una pista" }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(slotBox("api-entry")).getByRole("button", { name: "Ver pistas" }),
      ),
    );
    expect(announcements()).toEqual([`Pista 1: ${slotOf(pdfScenario, "api-entry").hints[0]}`]);
    expect(slotBox("api-entry").dataset.grade).toBe("empty");
  });

  it("«Ver solución completa» asks once, completes the scenario and the summary says so", async () => {
    withProgress();
    const user = await open();
    const [first, ...rest] = slotNodes(pdfScenario);
    const optimal = first?.answers.find((a) => a.grade === "optimal");
    if (first === undefined || optimal === undefined) throw new Error("no optimal answer");
    await press(user, slotButton(first.id));
    await user.click(paletteButton(optimal.service));

    await user.click(await menuItem(user, "Ver solución completa"));
    const notice = await screen.findByRole("alertdialog", { name: "¿Ver la solución completa?" });
    expect(notice.textContent).toContain(
      `Vas a ver la solución de los ${rest.length} casilleros que faltan.`,
    );
    expect(within(notice).queryByRole("button", { name: "Usar una pista" })).toBeNull();
    await user.click(within(notice).getByRole("button", { name: "Ver solución completa" }));

    const finish = screen.getByRole("button", { name: "Finalizar" });
    await waitFor(() => expect(document.activeElement).toBe(finish));
    expect(finish.getAttribute("aria-disabled")).toBe("false");
    expect(screen.queryAllByRole("alertdialog")).toEqual([]);
    for (const node of rest) expect(slotBox(node.id).dataset.grade).toBe("revealed");
    expect(announcements()).toEqual([
      `Se muestra la solución de ${rest.length} casilleros. Ya podés finalizar.`,
    ]);
    expect(await violations()).toEqual([]);

    await act(() => user.click(finish));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Escenario completado" }),
    ).toBeTruthy();
    expect(
      screen.getByText(`Completado viendo la solución de ${rest.length} casilleros`),
    ).toBeTruthy();
    const figures = screen.getByRole("region", { name: "Resultado" });
    expect(within(figures).getByText(String(bundle.rules.scoring.firstTryGreen))).toBeTruthy();
    expect(within(figures).getByText(`${rest.length} soluciones vistas`)).toBeTruthy();
    const stored = storedProgress();
    // Completed, but not in green (RF-NAV-01).
    expect(stored?.best[pdfScenario.id]?.allOptimal).toBe(false);
  });
});

describe("score end to end (static-website-https)", () => {
  const score = () => screen.getByText("Puntaje").nextElementSibling?.textContent;

  it("an optimal answer at the first attempt, without hints, adds 100 (slot first)", async () => {
    const user = await open(staticWebsiteScenario.id);
    expect(score()).toBe("0");
    await press(user, slotButton("dns"));
    await user.keyboard("Route 53{Enter}");
    expect(slotButton("dns").getAttribute("aria-label")).toContain("Óptimo");
    expect(score()).toBe(String(bundle.rules.scoring.firstTryGreen));
    expect(bundle.rules.scoring.firstTryGreen).toBe(100);
  });

  it("adds 100 per slot with service first too", async () => {
    const user = await open(staticWebsiteScenario.id);
    await user.click(paletteButton("route53"));
    await press(user, slotButton("dns"));
    await user.click(paletteButton("acm"));
    await press(user, slotButton("certificate"));
    expect(score()).toBe("200");
  });

  it("two incorrect answers before the optimal one in another slot add 50", async () => {
    const user = await open(staticWebsiteScenario.id);
    await user.click(paletteButton("route53"));
    await press(user, slotButton("dns"));
    expect(score()).toBe("100");

    await press(user, slotButton("certificate"));
    for (const wrong of ["kms", "secrets-manager"]) {
      await user.click(paletteButton(wrong));
      expect(slotButton("certificate").getAttribute("aria-label")).toContain("Incorrecto");
      expect(score()).toBe("100");
      await user.click(within(feedback()).getByRole("button", { name: "Probar otra" }));
    }
    await user.click(paletteButton("acm"));
    expect(slotButton("certificate").getAttribute("aria-label")).toContain("Óptimo");
    // max(min, firstTryGreen − penaltyPerError · 2) = max(25, 100 − 25 · 2) = 50.
    expect(bundle.rules.scoring.greenAfterErrors).toEqual({ penaltyPerError: 25, min: 25 });
    expect(score()).toBe("150");
  });
});

describe("board viewport", () => {
  const transform = () =>
    document.querySelector<HTMLElement>(".react-flow__viewport")?.style.transform;
  const zoom = () => screen.getByLabelText("Nivel de zoom").textContent;

  it("keeps zoom and position when placing, accepting, clearing and revealing hints", async () => {
    const user = await open();
    // The opening view (jsdom's board has no size: it does not fit, so it opens at 80 %).
    await waitFor(() => expect(transform()).toMatch(/scale\(0\.8\)/));
    const initial = transform();
    const still = () => {
      expect(transform()).toBe(initial);
      expect(zoom()).toMatch(/^80\s?%$/);
    };

    // Slot first: acceptable, "Me quedo con esta", "Probar otra", optimal.
    await press(user, slotButton("url-signer"));
    await user.click(paletteButton("fargate"));
    still();
    await user.click(within(feedback()).getByRole("button", { name: "Me quedo con esta" }));
    still();
    await user.click(within(feedback()).getByRole("button", { name: "Probar otra" }));
    still();
    await user.click(paletteButton("lambda"));
    still();
    // Service first: incorrect, then clear it.
    await user.click(paletteButton("ebs"));
    await press(user, slotButton("upload-store"));
    expect(slotButton("upload-store").getAttribute("aria-label")).toContain("Incorrecto");
    still();
    await user.click(within(feedback()).getByRole("button", { name: "Probar otra" }));
    still();
    // Slot first with the keyboard, the focus back on the slot, and a hint.
    await user.keyboard("Simple Storage{Enter}");
    expect(document.activeElement).toBe(slotButton("upload-store"));
    still();
    const slot = slotButton("api-entry").closest<HTMLElement>("[data-slot=architecture-slot]");
    if (slot === null) throw new Error("no slot");
    await press(user, within(slot).getByRole("button", { name: /Ver pista/ }));
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    still();

    // "Ajustar a pantalla" is the only thing, besides opening, that fits the board.
    await user.click(screen.getByRole("button", { name: "Ajustar a la pantalla" }));
    // Animated: the first frames can still read 80 %.
    await waitFor(() => {
      expect(transform()).not.toBe(initial);
      expect(zoom()).not.toMatch(/^80\s?%$/);
    });
  });
});

describe("brief", () => {
  it("opens on entering with the case, restrictions apart from goals and a still preview", async () => {
    await open(pdfScenario.id, { closeBrief: false });
    const brief = screen.getByRole("dialog", { name: pdfScenario.title });
    expect(within(brief).getByText(/^Nivel 200$/i)).toBeTruthy();
    expect(within(brief).getByText(`${pdfScenario.estimatedMinutes} min`)).toBeTruthy();

    const listOf = (name: string) =>
      [
        ...(within(brief)
          .getByRole("heading", { name })
          .closest("section")
          ?.querySelectorAll("li") ?? []),
      ].map((li) => li.textContent);
    const hard = pdfScenario.objectives.filter((o) => o.kind === "hard").map((o) => o.text);
    const soft = pdfScenario.objectives.filter((o) => o.kind === "soft").map((o) => o.text);
    expect(listOf("Restricciones")).toEqual(hard);
    expect(listOf("Metas")).toEqual(soft);
    // Goals do not carry the check of "met" (problem 21).
    for (const goal of brief.querySelectorAll("li[data-kind=soft] svg")) {
      expect(goal.getAttribute("class")).not.toMatch(/lucide-check\b/);
    }

    const preview = within(brief).getByRole("img", { name: /Vista previa del diagrama/ });
    await waitFor(() =>
      expect(preview.querySelectorAll("[data-slot=architecture-slot]")).toHaveLength(
        slotNodes(pdfScenario).length,
      ),
    );
    for (const slot of preview.querySelectorAll("[data-slot=architecture-slot]")) {
      expect(slot.textContent).toBe("");
    }
    expect(within(preview).queryAllByRole("button")).toHaveLength(0);
  });

  it("traps the focus on its start button and gives it to the board when it closes", async () => {
    const user = await open(pdfScenario.id, { closeBrief: false });
    const brief = screen.getByRole("dialog", { name: pdfScenario.title });
    const start = within(brief).getByRole("button", { name: /Empezar a diseñar/ });
    await waitFor(() => expect(document.activeElement).toBe(start));
    // Tab never leaves the dialog.
    for (let i = 0; i < 6; i++) {
      await user.tab();
      expect(brief.contains(document.activeElement)).toBe(true);
    }
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: `Diagrama de «${pdfScenario.title}»` }),
    );
  });
});

describe('"Ver caso"', () => {
  it("shows the case and the steps of the flow in a panel without a scrim", async () => {
    const user = await open(staticWebsiteScenario.id);
    const button = screen.getByRole("button", { name: "Ver caso" });
    await user.click(button);
    const panel = await screen.findByRole("dialog", { name: staticWebsiteScenario.title });
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(within(panel).getByRole("heading", { name: "Restricciones" })).toBeTruthy();
    expect(within(panel).getByRole("heading", { name: "Metas" })).toBeTruthy();
    expect(panel.textContent).toContain("Una ONG tiene un sitio institucional");

    const steps = within(panel).getByRole("heading", { name: "Pasos del flujo" });
    const items = steps.closest("section")?.querySelectorAll("li") ?? [];
    expect(items).toHaveLength(
      new Set(staticWebsiteScenario.diagram.edges.map((e) => e.step)).size,
    );
    expect(items[1]?.textContent).toContain("Paso 2:");
    expect(items[1]?.textContent).toContain("Resuelve el dominio");
    expect(items[1]?.textContent).toContain(`Visitantes → ${roleOf(staticWebsiteScenario, "dns")}`);
    // Nothing names a hidden service (RF-PLAY-02).
    expect(panel.textContent).not.toMatch(/Route 53|CloudFront|Amazon S3|Certificate Manager/);
    // Non-modal: no scrim, and the board is not hidden from assistive technologies.
    expect(document.querySelector("[data-slot=dialog-overlay]")).toBeNull();
    expect(screen.getByRole("group", { name: /^Diagrama de/ })).toBeTruthy();
  });

  it("takes the focus without trapping it; Esc or X close it and give the focus back", async () => {
    const user = await open();
    const button = screen.getByRole("button", { name: "Ver caso" });
    await user.click(button);
    const panel = await screen.findByRole("dialog");
    await waitFor(() => expect(document.activeElement).toBe(panel));
    // No trap: Tab eventually leaves the panel.
    let left = false;
    for (let i = 0; i < 12 && !left; i++) {
      await user.tab();
      left = !panel.contains(document.activeElement);
    }
    expect(left).toBe(true);

    panel.querySelector<HTMLElement>("button")?.focus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);

    await user.click(button);
    await user.click(await screen.findByRole("button", { name: "Cerrar el caso" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(button);
  });

  it("keeps the board and the palette operable while it is open", async () => {
    const user = await open();
    await user.click(screen.getByRole("button", { name: "Ver caso" }));
    await screen.findByRole("dialog");
    // The zoom controls and the feedback card keep clear of the panel.
    await waitFor(() =>
      expect(
        document.querySelector<HTMLElement>("[data-slot=board-controls]")?.style.left,
      ).not.toBe(""),
    );
    expect(live().style.left).not.toBe("");

    // Slot first with the keyboard, and service first with clicks, with the panel open.
    await press(user, slotButton("upload-store"));
    expect(document.activeElement).toBe(screen.getByRole("searchbox"));
    await user.keyboard("Simple Storage{Enter}");
    expect(slotButton("upload-store").getAttribute("aria-label")).toContain("Óptimo: Amazon S3");
    await user.click(paletteButton("apigateway"));
    await press(user, slotButton("api-entry"));
    expect(slotButton("api-entry").getAttribute("aria-label")).toContain("Óptimo");
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Esc on the board cancels the selection and leaves the panel open.
    await press(user, slotButton("url-signer"));
    slotButton("url-signer").focus();
    await user.keyboard("{Escape}");
    expect(slotButton("url-signer").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("dialog")).toBeTruthy();

    // Closed, the board gets its whole width back.
    await user.click(screen.getByRole("button", { name: "Cerrar el caso" }));
    await waitFor(() => expect(live().style.left).toBe(""));
  });
});

describe("collapsed palette", () => {
  it("collapses to named icons, remembered as a preference outside the progress", async () => {
    withProgress();
    const progressBefore = localStorage.getItem(PROGRESS_STORAGE_KEY);
    const user = await open();
    const palette = () => screen.getByRole("complementary", { name: "Paleta de servicios" });
    const toggle = within(palette()).getByRole("button", { name: "Colapsar la paleta" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle);

    expect(within(palette()).queryByRole("searchbox")).toBeNull();
    const expand = within(palette()).getByRole("button", { name: "Expandir la paleta" });
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(paletteButton("s3").getAttribute("aria-label")).toBe("Amazon S3");
    expect(localStorage.getItem(PALETTE_COLLAPSED_KEY)).toBe("true");
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(progressBefore);

    // Slot first still works: the focus goes to the first icon, and choosing one places it.
    await press(user, slotButton("upload-store"));
    expect(document.activeElement?.hasAttribute("data-palette-service")).toBe(true);
    await user.click(paletteButton("s3"));
    expect(slotButton("upload-store").getAttribute("aria-label")).toContain("Óptimo: Amazon S3");
    expect(paletteButton("s3").getAttribute("aria-label")).toBe("Amazon S3 (en uso)");

    // Next visit: still collapsed.
    cleanup();
    await open();
    expect(within(palette()).getByRole("button", { name: "Expandir la paleta" })).toBeTruthy();
  });
});

describe("focus mode", () => {
  let fullscreen: Element | null = null;
  const change = () => document.dispatchEvent(new Event("fullscreenchange"));
  const fakeFullscreen = (grant: boolean) => {
    fullscreen = null;
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreen,
    });
    const request = vi.fn(() => {
      if (!grant) return Promise.reject(new TypeError("Permissions check failed"));
      fullscreen = document.documentElement;
      change();
      return Promise.resolve();
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: vi.fn(() => {
        fullscreen = null;
        change();
        return Promise.resolve();
      }),
    });
    return request;
  };
  afterEach(() => {
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(document, "exitFullscreen");
    Reflect.deleteProperty(Element.prototype, "requestFullscreen");
  });

  const enter = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: "Modo foco" }));
    const exit = await screen.findByRole("button", { name: "Salir del foco" });
    await waitFor(() => expect(document.activeElement).toBe(exit));
    return exit;
  };
  const inFocusMode = () => {
    // The game bar is gone; the minimal bar keeps progress, "Ver caso" and "Finalizar".
    expect(screen.queryByRole("button", { name: "Modo foco" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull();
    // "Reproducir flujo" leaves the bar only in focus mode (CA RF-PLAY-15).
    expect(screen.queryByRole("button", { name: "Reproducir flujo" })).toBeNull();
    const bar = document.querySelector<HTMLElement>("[data-slot=focus-bar]");
    if (bar === null) throw new Error("no focus bar");
    expect(within(bar).getByText(/de \d+ casilleros/)).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Ver caso" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Finalizar" })).toBeTruthy();
    // The page keeps its heading, the board and the palette.
    expect(screen.getByRole("heading", { level: 1, name: pdfScenario.title })).toBeTruthy();
    expect(screen.getByRole("complementary", { name: "Paleta de servicios" })).toBeTruthy();
  };

  it("asks for full screen, and leaving it gives the bar and the focus back", async () => {
    const request = fakeFullscreen(true);
    const user = await open();
    const exit = await enter(user);
    expect(request).toHaveBeenCalledTimes(1);
    expect(fullscreen).toBe(document.documentElement);
    inFocusMode();
    await user.click(exit);
    const button = await screen.findByRole("button", { name: "Modo foco" });
    await waitFor(() => expect(document.activeElement).toBe(button));
    expect(fullscreen).toBeNull();
  });

  it("goes on without full screen when the browser refuses it", async () => {
    const request = fakeFullscreen(false);
    const user = await open();
    await enter(user);
    expect(request).toHaveBeenCalledTimes(1);
    expect(fullscreen).toBeNull();
    inFocusMode();
  });

  it("goes on when the player leaves full screen with Esc", async () => {
    fakeFullscreen(true);
    const user = await open();
    await enter(user);
    act(() => {
      fullscreen = null;
      change();
    });
    inFocusMode();
    // "Ver caso" still works from the minimal bar.
    await user.click(screen.getByRole("button", { name: "Ver caso" }));
    expect(await screen.findByRole("dialog", { name: pdfScenario.title })).toBeTruthy();
  });
});

describe("feedback card position", () => {
  /** Board 1200 × 800; each slot where the test puts it (others out of view); card 760 × 180. */
  let cardAt: { x: number; y: number } | null = null;
  const layout = (
    slots: Record<string, { x: number; y: number }>,
    card: { x: number; y: number } | null = null,
  ) => {
    cardAt = card;
    const rect = (x: number, y: number, w: number, h: number) =>
      ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h }) as DOMRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      if (!(this instanceof HTMLElement)) return rect(0, 0, 0, 0);
      if (this.dataset.slot === "board-area" || this.dataset.slot === "feedback-layer") {
        return rect(0, 0, 1200, 800);
      }
      // The zoom controls, bottom-left: the card at the bottom floats above them.
      if (this.dataset.slot === "board-controls") return rect(16, 740, 170, 44);
      // The card, where the test says it is.
      if (this.dataset.slotFeedback !== undefined) {
        return cardAt === null ? rect(-500, -500, 10, 10) : rect(cardAt.x, cardAt.y, 760, 180);
      }
      const at = this.dataset.slotId === undefined ? undefined : slots[this.dataset.slotId];
      return at === undefined ? rect(-500, -500, 10, 10) : rect(at.x, at.y, 160, 160);
    });
    const size = (dimension: "width" | "height", card: number) => ({
      configurable: true,
      get(this: HTMLElement) {
        if (this.dataset.slotFeedback !== undefined) return card;
        return parseFloat(this.style[dimension]) || 1;
      },
    });
    Object.defineProperties(HTMLElement.prototype, {
      offsetWidth: size("width", 760),
      offsetHeight: size("height", 180),
    });
  };

  const card = () => {
    const element = document.querySelector<HTMLElement>("[data-slot-feedback]");
    if (element === null) throw new Error("no feedback card");
    return element;
  };

  it("floats at the bottom when its slot is up, and at the top when its slot is down", async () => {
    const user = await open();
    layout({ "api-entry": { x: 520, y: 40 }, "upload-store": { x: 520, y: 560 } });

    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("alb"));
    await waitFor(() => expect(card().dataset.side).toBe("bottom"));
    expect(card().dataset.slotFeedback).toBe("api-entry");
    // Above the zoom controls: 800 − 740 + 8 px.
    expect(card().style.bottom).toBe("68px");

    await press(user, slotButton("upload-store"));
    await user.click(paletteButton("ebs"));
    await waitFor(() => expect(card().dataset.slotFeedback).toBe("upload-store"));
    await waitFor(() => expect(card().dataset.side).toBe("top"));
    expect(card().style.top).toBe("16px");
  });

  it("closes when a slot reached with the keyboard would be hidden under it", async () => {
    const user = await open();
    // The card of api-entry sits over upload-store (a small board, a large zoom).
    layout(
      { "api-entry": { x: 40, y: 40 }, "upload-store": { x: 520, y: 560 } },
      { x: 220, y: 540 },
    );
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("alb"));
    expect(card().dataset.slotFeedback).toBe("api-entry");
    // Its own slot keeps it open.
    slotButton("api-entry").focus();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(document.querySelector("[data-slot-feedback]")).not.toBeNull();
    // Another slot under it closes it.
    slotButton("upload-store").focus();
    await waitFor(() => expect(document.querySelector("[data-slot-feedback]")).toBeNull());
  });

  it("appears when a resolved slot is activated and closes with its X", async () => {
    const user = await open();
    await press(user, slotButton("api-entry"));
    await user.click(paletteButton("apigateway"));
    await user.click(within(feedback()).getByRole("button", { name: "Cerrar explicación" }));
    expect(screen.queryByRole("region", { name: /Óptimo/ })).toBeNull();
    await press(user, slotButton("api-entry"));
    expect(feedback().dataset.status).toBe("optimal");
  });
});
