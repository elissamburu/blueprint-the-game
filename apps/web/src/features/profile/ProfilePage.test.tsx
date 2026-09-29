// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The profile through the real routes (RF-GAM-01, RF-ONB-03): rank and progress to the next one,
// completed scenarios, open levels, editing areas and experience, and resetting the progress.
import {
  applyScenarioResult,
  scenarioResult,
  slotNodes,
  applyCommand,
  commands,
  type PlayerProgress,
} from "@blueprint/game-engine";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type RunOptions } from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { useProgressStore } from "../../progress/progress-store";
import { newProgress, storedProgress, storeProgress } from "../../testing/progress-fixture";
import { bundle, newSession, pdfScenario } from "../play/testing/game-fixture";

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  localStorage.clear();
  vi.stubGlobal("fetch", fetchFrom(bundleFiles(["published", "published", "published"])));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderProfile = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/perfil"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { level: 1, name: "Tu perfil" });
  return user;
};

/** The PDF scenario completed green at the first attempt. */
const withPdfCompleted = (progress: PlayerProgress): PlayerProgress => {
  const session = slotNodes(pdfScenario).reduce((state, node) => {
    const optimal = node.answers.find((a) => a.grade === "optimal");
    if (optimal === undefined) throw new Error("slot without optimal");
    return applyCommand(state, commands.placeService(node.id, optimal.service)).state;
  }, newSession());
  return applyScenarioResult(
    progress,
    scenarioResult(session),
    bundle.rules,
    bundle.index.scenarios,
  ).progress;
};

const rankBand = () => screen.getByRole("region", { name: "Rango actual" });

describe("profile", () => {
  it("sends a player without progress to the onboarding", async () => {
    render(
      <MemoryRouter initialEntries={["/perfil"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("radiogroup", { name: "¿Cuál es tu experiencia?" }),
    ).toBeTruthy();
  });

  it("shows the rank and the progress to the next one, from game-rules.yaml", async () => {
    storeProgress({ ...newProgress("aws-user"), xp: 1840 });
    await renderProfile();
    expect(within(rankBand()).getByText("Constructor")).toBeTruthy();
    expect(within(rankBand()).getByText("1.840 de 5.000 XP para alcanzar Arquitecto")).toBeTruthy();
    const bar = within(rankBand()).getByRole("progressbar", { name: "Progreso hacia Arquitecto" });
    expect(bar.getAttribute("aria-valuemin")).toBe("1000");
    expect(bar.getAttribute("aria-valuemax")).toBe("5000");
    expect(bar.getAttribute("aria-valuenow")).toBe("1840");
    expect(bar.getAttribute("aria-valuetext")).toBe("1.840 de 5.000 XP");
    // Only the rank: no "Nv. N", badges, mastery, album nor streak.
    expect(
      screen.queryByText(/Nv\.|Nivel 7|Insignias|Maestría|Álbum|racha|Meta diaria/i),
    ).toBeNull();
  });

  it("has no progress bar at the highest rank", async () => {
    storeProgress({ ...newProgress("aws-user"), xp: 45_000 });
    await renderProfile();
    expect(within(rankBand()).getByText("Principal")).toBeTruthy();
    expect(within(rankBand()).getByText("45.000 XP. Llegaste al rango más alto.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("lists the completed scenarios with their best result and the open levels by area", async () => {
    storeProgress(withPdfCompleted(newProgress("aws-user")));
    await renderProfile();
    expect(screen.getByText("1 escenario completado")).toBeTruthy();
    const completed = screen.getByRole("region", { name: "Escenarios completados" });
    expect(within(completed).getByText(pdfScenario.title)).toBeTruthy();
    const max = slotNodes(pdfScenario).length * 100;
    expect(within(completed).getByText(new RegExp(`Mejor puntaje: ${max} de ${max}`))).toBeTruthy();

    const levels = screen.getByRole("region", { name: "Niveles desbloqueados" });
    const serverless = within(levels).getByText("Serverless").parentElement;
    if (serverless === null) throw new Error("no serverless row");
    // Completing the only serverless scenario of level 200 opened 300 (CA RF-NAV-03).
    expect(
      within(serverless)
        .getAllByText(/Nivel/)
        .map((b) => b.textContent),
    ).toEqual(["Nivel 100", "Nivel 200", "Nivel 300"]);
  });

  it("edits the areas and raises the experience, opening its levels (RF-ONB-03)", async () => {
    storeProgress(newProgress("aws-user", ["serverless"]));
    const user = await renderProfile();
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(save.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "No hay cambios para guardar.",
    );
    expect(screen.getByRole("button", { name: "Serverless" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("radio", { name: "Uso AWS" }).getAttribute("aria-checked")).toBe(
      "true",
    );
    const group = screen.getByRole("radiogroup", { name: "¿Cuál es tu experiencia?" });
    expect(document.getElementById(group.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Cambiar tu experiencia solo puede abrir niveles nuevos: los que ya desbloqueaste siguen abiertos.",
    );

    await user.click(screen.getByRole("button", { name: "Redes" }));
    await user.click(screen.getByRole("radio", { name: "Diseño arquitecturas" }));
    expect(save.getAttribute("aria-disabled")).toBe("false");
    await act(() => user.click(save));

    const stored = storedProgress();
    expect(stored?.interests).toEqual(["serverless", "networking"]);
    expect(stored?.experience).toBe("architect");
    expect(stored?.unlocked).toContainEqual({ area: "serverless", level: 300 });
    // The new levels, by area, inline next to the button: no toast.
    const areas = new Intl.ListFormat("es", { type: "conjunction" }).format(
      [...new Set(bundle.index.scenarios.flatMap((s) => s.areas))]
        .sort()
        .map((id) => bundle.index.areas.find((a) => a.id === id)?.name ?? id),
    );
    const status = screen.getByRole("status");
    await waitFor(() => expect(status.textContent).toBe(`Desbloqueaste el nivel 300 en ${areas}.`));
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(document.querySelector("[data-sonner-toast]")).toBeNull();
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(save.getAttribute("aria-describedby")).toBe(status.id);

    // It does not go away by itself…
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(status.textContent).toBe(`Desbloqueaste el nivel 300 en ${areas}.`);
    // …only when the player edits again.
    await user.click(screen.getByRole("button", { name: "Datos y analítica" }));
    expect(status.textContent).toBe("");
  });

  it("never closes a level when the experience goes down", async () => {
    const before = newProgress("architect");
    storeProgress(before);
    const user = await renderProfile();
    await user.click(screen.getByRole("radio", { name: "Recién empiezo" }));
    await act(() => user.click(screen.getByRole("button", { name: "Guardar cambios" })));
    await waitFor(() => expect(storedProgress()?.experience).toBe("beginner"));
    expect(storedProgress()?.unlocked).toEqual(before.unlocked);
    // Nothing new opened: just "saved", with the same mechanism.
    expect(screen.getByRole("status").textContent).toBe("Cambios guardados");
    await user.click(screen.getByRole("radio", { name: "Experto" }));
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("does not save without an area", async () => {
    storeProgress(newProgress("aws-user", ["serverless"]));
    const user = await renderProfile();
    await user.click(screen.getByRole("button", { name: "Serverless" }));
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    expect(save.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(save.getAttribute("aria-describedby") ?? "")?.textContent).toBe(
      "Elegí al menos un área.",
    );
    await user.click(save);
    expect(storedProgress()?.interests).toEqual(["serverless"]);
  });

  it("resets the progress after confirming, and goes back to the onboarding", async () => {
    storeProgress(withPdfCompleted(newProgress("aws-user")));
    const user = await renderProfile();
    await user.click(screen.getByRole("button", { name: "Reiniciar progreso" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿Reiniciar tu progreso?" });
    // Cancelling keeps everything.
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(storedProgress()).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Reiniciar progreso" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Sí, reiniciar" }),
    );
    expect(
      await screen.findByRole("radiogroup", { name: "¿Cuál es tu experiencia?" }),
    ).toBeTruthy();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
  });

  it("cannot save nor reset while the stored progress is incompatible", async () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, progress: {} }),
    );
    const user = await renderProfile();
    const notice =
      "Tu progreso fue guardado con una versión más nueva del juego. Recargá la página para verlo; mientras tanto no se puede editar ni reiniciar.";
    expect(screen.getByText(notice)).toBeTruthy();
    for (const name of ["Guardar cambios", "Reiniciar progreso"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      expect(
        document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent,
      ).toBe(notice);
    }
    await user.click(screen.getByRole("button", { name: "Reiniciar progreso" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? "{}")).toMatchObject({
      schemaVersion: 999,
    });
  });

  it("has no axe violations, with the reset dialog closed and open", async () => {
    storeProgress(withPdfCompleted({ ...newProgress("aws-user"), xp: 1840 }));
    const user = await renderProfile();
    const options: RunOptions = {
      resultTypes: ["violations"],
      // jsdom does not compute styles: contrast is checked on the tokens (docs/design).
      rules: { "color-contrast": { enabled: false } },
    };
    expect((await axe.run(document.body, options)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Reiniciar progreso" }));
    await screen.findByRole("alertdialog");
    expect((await axe.run(document.body, options)).violations).toEqual([]);
  });
});
