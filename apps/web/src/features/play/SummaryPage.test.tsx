// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The summary through the real routes (RF-PLAY-09, RF-PLAY-13, RF-GAM-10), with the result in the
// navigation state as "Finalizar" leaves it.
import {
  applyCommand,
  commands,
  scenarioResult,
  slotNodes,
  type BestComparison,
  type ProgressEvent,
  type SessionState,
} from "@blueprint/game-engine";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import axe, { type RunOptions } from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { useProgressStore } from "../../progress/progress-store";
import { newProgress, storeProgress } from "../../testing/progress-fixture";
import { summaryState } from "./finish";
import { bundle, newSession, pdfScenario, services } from "./testing/game-fixture";

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  localStorage.clear();
  storeProgress(newProgress("aws-user"));
  vi.stubGlobal("fetch", fetchFrom(bundleFiles(["published", "published", "published"])));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const nodes = slotNodes(pdfScenario);
const optimalOf = (index: number) => {
  const answer = nodes[index]?.answers.find((a) => a.grade === "optimal");
  if (answer === undefined) throw new Error("slot without optimal");
  return answer;
};
const acceptableSlot = nodes.findIndex((n) => n.answers.some((a) => a.grade === "acceptable"));
const acceptable = nodes[acceptableSlot]?.answers.find((a) => a.grade === "acceptable");
/** A green slot where the player used one hint. */
const hintSlot = acceptableSlot === 0 ? 1 : 0;

/**
 * Completed session: the slot with an acceptable answer kept orange, `hintSlot` green after one
 * hint, every other slot green at the first attempt.
 */
const played = (): SessionState =>
  nodes.reduce((state, node, index) => {
    const run = (s: SessionState, ...cmds: ReturnType<typeof commands.useHint>[]) =>
      cmds.reduce((current, cmd) => applyCommand(current, cmd).state, s);
    if (index === acceptableSlot && acceptable !== undefined) {
      return run(
        state,
        commands.placeService(node.id, acceptable.service),
        commands.acceptAcceptable(node.id),
      );
    }
    if (index === hintSlot) {
      return run(
        state,
        commands.useHint(node.id),
        commands.placeService(node.id, optimalOf(index).service),
      );
    }
    return run(state, commands.placeService(node.id, optimalOf(index).service));
  }, newSession());

const [aprendiz, constructor] = bundle.rules.ranks;

const stateFor = (
  comparison: BestComparison | null,
  events: readonly ProgressEvent[] = [],
  session = played(),
) =>
  summaryState({ result: scenarioResult(session), saved: comparison !== null, comparison, events });

const renderSummary = (state: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: `/escenarios/${pdfScenario.id}/resumen`, state }]}>
      <AppRoutes />
    </MemoryRouter>,
  );

const title = () => screen.findByRole("heading", { level: 1, name: "Escenario completado" });
const live = () => document.querySelector<HTMLElement>("[aria-live=polite].sr-only");

describe("summary", () => {
  it("says there is nothing to show when opened without a result", async () => {
    renderSummary(undefined);
    expect(await title()).toBeTruthy();
    expect(
      screen.getByText("No hay un resultado para mostrar: jugá el escenario y finalizalo."),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ver escenarios" })).toBeTruthy();
  });

  it("shows the score against the real maximum, the XP with its multiplier and the slots by grade", async () => {
    const result = scenarioResult(played());
    renderSummary(stateFor({ kind: "first", gained: result.xp }));
    await title();
    const figures = screen.getByRole("region", { name: "Resultado" });
    expect(within(figures).getByText(String(result.score))).toBeTruthy();
    expect(within(figures).getByText(`de ${nodes.length * 100}`)).toBeTruthy();
    expect(within(figures).getByText(`+${result.xp}`)).toBeTruthy();
    expect(
      within(figures).getByText(`${result.score} pts × 1,5 (nivel 200) = ${result.xp} XP`),
    ).toBeTruthy();
    expect(within(figures).getByText(`${nodes.length - 1} óptimos`)).toBeTruthy();
    expect(within(figures).getByText("1 aceptable")).toBeTruthy();
    // No badges in F1.
    expect(screen.queryByText(/insignia/i)).toBeNull();
  });

  it("focuses the title and announces the XP, the new rank and the unlocked level", async () => {
    if (aprendiz === undefined || constructor === undefined) throw new Error("< 2 ranks");
    const result = scenarioResult(played());
    renderSummary(
      stateFor({ kind: "first", gained: result.xp }, [
        { type: "xpGained", amount: result.xp, total: result.xp },
        { type: "rankUp", from: aprendiz, to: constructor },
        { type: "levelUnlocked", level: 300, areas: ["serverless", "storage"] },
      ]),
    );
    const heading = await title();
    await waitFor(() => expect(document.activeElement).toBe(heading));
    const achievements = screen.getByRole("region", { name: "Logros" });
    expect(within(achievements).getByText(`Subiste a ${constructor.name}.`)).toBeTruthy();
    expect(
      within(achievements).getByText("Nivel 300 en Serverless y Almacenamiento."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(live()?.textContent).toBe(
        `Ganaste ${result.xp} XP. Subiste a ${constructor.name}. Nivel 300 en Serverless y Almacenamiento.`,
      ),
    );
  });

  it("celebrates a rank up: the trophy and the badge scale in, and confetti falls once", async () => {
    if (aprendiz === undefined || constructor === undefined) throw new Error("< 2 ranks");
    renderSummary(
      stateFor({ kind: "first", gained: 1 }, [{ type: "rankUp", from: aprendiz, to: constructor }]),
    );
    await title();
    expect(document.querySelector(".motion-badge")).not.toBeNull();
    const badge = screen
      .getByRole("region", { name: "Logros" })
      .querySelector(".motion-badge-late");
    expect(badge).not.toBeNull();
    const confetti = document.querySelector<HTMLElement>("[data-slot=confetti]");
    expect(confetti?.getAttribute("aria-hidden")).toBe("true");
    expect(confetti?.className).toMatch(/pointer-events-none/);
    expect(confetti?.querySelectorAll("i")).toHaveLength(10);
  });

  it("throws no confetti without a rank up nor an unlocked level", async () => {
    renderSummary(stateFor({ kind: "first", gained: 1 }));
    await title();
    expect(document.querySelector("[data-slot=confetti]")).toBeNull();
  });

  it("with reduced motion only fades the trophy and the badge in, without confetti", async () => {
    if (aprendiz === undefined || constructor === undefined) throw new Error("< 2 ranks");
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    renderSummary(
      stateFor({ kind: "first", gained: 1 }, [
        { type: "rankUp", from: aprendiz, to: constructor },
        { type: "levelUnlocked", level: 300, areas: ["serverless"] },
      ]),
    );
    await title();
    expect(document.querySelector("[data-slot=confetti]")).toBeNull();
    expect(document.querySelector(".motion-badge, .motion-badge-late")).toBeNull();
    const faded = document.querySelectorAll(".animate-in.fade-in");
    // The trophy and the two achievements.
    expect(faded).toHaveLength(3);
  });

  it("says when the XP does not go up because the best result was higher or equal", async () => {
    renderSummary(stateFor({ kind: "lower", gained: 0, previousXp: 99_999 }));
    await title();
    expect(screen.getByText("+0")).toBeTruthy();
    expect(screen.getByText("Tu mejor resultado ya era mayor: +0 XP")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Logros" })).toBeNull();
    await waitFor(() =>
      expect(live()?.textContent).toBe("No sumaste XP: tu mejor resultado ya era igual o mayor."),
    );
    cleanup();
    renderSummary(stateFor({ kind: "equal", gained: 0, previousXp: 100 }));
    expect(await screen.findByText("Igualaste tu mejor resultado: +0 XP")).toBeTruthy();
  });

  it("reviews every slot: the choice with its grade, the hints, the optimal explanation and its documentation", async () => {
    renderSummary(stateFor({ kind: "first", gained: 1 }));
    await title();
    const review = screen.getByRole("region", { name: "Casillero por casillero" });
    const items = within(review)
      .getAllByRole("listitem")
      .filter((li) => li.parentElement?.tagName === "OL");
    expect(items).toHaveLength(nodes.length);

    // A green slot with one hint.
    const first = items[hintSlot];
    if (first === undefined) throw new Error("no items");
    const optimal = optimalOf(hintSlot);
    expect(within(first).getByText(`Casillero ${hintSlot + 1}`)).toBeTruthy();
    expect(within(first).getByText(nodes[hintSlot]?.role ?? "")).toBeTruthy();
    expect(within(first).getByRole("heading", { level: 3 }).textContent).toBe(
      `Tu elección: ${services.get(optimal.service)?.name}`,
    );
    expect(within(first).getByText("Óptimo")).toBeTruthy();
    expect(within(first).getByText(/^1 pista · 85 pts$/)).toBeTruthy();
    const docs = within(first).getAllByRole("link");
    expect(docs.map((a) => a.getAttribute("href"))).toEqual(optimal.references);
    for (const link of docs) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.textContent).toContain("(se abre en otra pestaña)");
    }

    // The orange kept by the player: its grade and the optimal answer next to it.
    const orange = items[acceptableSlot];
    if (orange === undefined || acceptable === undefined) throw new Error("no acceptable slot");
    expect(within(orange).getByRole("heading", { level: 3 }).textContent).toBe(
      `Tu elección: ${services.get(acceptable.service)?.name}`,
    );
    expect(within(orange).getByText("Aceptable")).toBeTruthy();
    expect(within(orange).getByText(/^Sin pistas · 50 pts$/)).toBeTruthy();
    expect(
      within(orange).getByText(
        new RegExp(services.get(optimalOf(acceptableSlot).service)?.name ?? ""),
      ),
    ).toBeTruthy();
  });

  it("offers replaying, the scenarios and reporting a problem", async () => {
    renderSummary(stateFor({ kind: "first", gained: 1 }));
    await title();
    expect(screen.getByRole("link", { name: "Volver a jugar" }).getAttribute("href")).toBe(
      `/escenarios/${pdfScenario.id}`,
    );
    expect(screen.getByRole("link", { name: "Ver escenarios" }).getAttribute("href")).toBe(
      "/escenarios",
    );
    expect(screen.getByRole("link", { name: "Versión imprimible" }).getAttribute("href")).toBe(
      `/escenarios/${pdfScenario.id}/imprimir`,
    );
    const report = screen.getByRole("link", { name: /Reportar un problema en este escenario/ });
    const url = new URL(report.getAttribute("href") ?? "");
    expect(url.pathname).toMatch(/\/issues\/new$/);
    expect(url.searchParams.get("scenario")).toBe(pdfScenario.id);
    expect(url.searchParams.get("version")).toBe(String(pdfScenario.version));
    expect(report.getAttribute("target")).toBe("_blank");
    expect(report.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("reviews viewed solutions as «Solución vista» with 0 points: completed, not green", async () => {
    // First slot after an error, the rest revealed with "Ver solución completa".
    const session = [
      commands.placeService(nodes[0]?.id ?? "", "route53"),
      commands.revealSolution(nodes[0]?.id ?? ""),
      commands.revealSolution(null),
    ].reduce((state, cmd) => applyCommand(state, cmd).state, newSession());
    renderSummary(stateFor({ kind: "first", gained: 0 }, [], session));
    await title();
    expect(
      screen.getByText(`Completado viendo la solución de ${nodes.length} casilleros`),
    ).toBeTruthy();
    const figures = screen.getByRole("region", { name: "Resultado" });
    expect(within(figures).getByText(`${nodes.length} soluciones vistas`)).toBeTruthy();
    const review = document.querySelectorAll("section[aria-labelledby=summary-review] ol > li");
    expect(review).toHaveLength(nodes.length);
    for (const [index, item] of [...review].entries()) {
      const optimal = services.get(optimalOf(index).service)?.name ?? "";
      expect(item.querySelector("[data-grade=revealed]")?.textContent).toBe("Solución vista");
      expect(within(item as HTMLElement).getByRole("heading", { level: 3 }).textContent).toBe(
        `Solución vista: ${optimal}`,
      );
      expect(item.textContent).toContain("0 pts");
    }
    expect(review[0]?.textContent).toContain("1 intento incorrecto");
    expect(
      (
        await axe.run(document.body, {
          resultTypes: ["violations"],
          rules: { "color-contrast": { enabled: false } },
        })
      ).violations,
    ).toEqual([]);
  });

  it("names the other optimal answers of a viewed solution", async () => {
    // The PDF scenario with alb (acceptable in content) as a second optimal answer of api-entry.
    const files = bundleFiles(["published", "published", "published"]);
    const raw = files["serverless-pdf-processing.v1.json"] as typeof pdfScenario;
    const twoOptimal = {
      ...raw,
      diagram: {
        ...raw.diagram,
        nodes: raw.diagram.nodes.map((node) =>
          node.type === "slot" && node.id === "api-entry"
            ? {
                ...node,
                answers: node.answers.map((a) =>
                  a.service === "alb" ? { ...a, grade: "optimal" as const } : a,
                ),
              }
            : node,
        ),
      },
    };
    // Under another file name: the content store keeps the scenarios it loaded, by file.
    const file = "serverless-pdf-processing.v99.json";
    const index = files["index.json"] as { scenarios: { id: string; file: string }[] };
    const withFile = {
      ...index,
      scenarios: index.scenarios.map((s) => (s.id === raw.id ? { ...s, file } : s)),
    };
    vi.stubGlobal("fetch", fetchFrom({ ...files, "index.json": withFile, [file]: twoOptimal }));
    const session = applyCommand(
      newSession(twoOptimal),
      commands.revealSolution("api-entry"),
    ).state;
    renderSummary(stateFor({ kind: "first", gained: 0 }, [], session));
    await title();
    const first = document.querySelector("section[aria-labelledby=summary-review] ol > li");
    expect(first?.textContent).toContain("Solución vista: Amazon API Gateway");
    expect(first?.textContent).toContain(
      `También es óptimo: ${services.get("alb")?.name ?? "alb"}`,
    );
    // Only for viewed solutions: a green chosen by the player does not get the line.
    expect(document.body.textContent).not.toMatch(/También son óptimos/);
  });

  it("has no axe violations, with and without a rank up", async () => {
    if (aprendiz === undefined || constructor === undefined) throw new Error("< 2 ranks");
    const options: RunOptions = {
      resultTypes: ["violations"],
      // jsdom does not compute styles: contrast is checked on the tokens (docs/design).
      rules: { "color-contrast": { enabled: false } },
    };
    renderSummary(stateFor({ kind: "improved", gained: 10, previousXp: 5 }));
    await title();
    expect((await axe.run(document.body, options)).violations).toEqual([]);
    cleanup();
    renderSummary(
      stateFor({ kind: "first", gained: 1 }, [{ type: "rankUp", from: aprendiz, to: constructor }]),
    );
    await title();
    expect((await axe.run(document.body, options)).violations).toEqual([]);
  });
});
