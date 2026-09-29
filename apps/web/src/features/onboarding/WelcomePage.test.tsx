// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The onboarding through the real routes (RF-ONB-01, RF-ONB-02): areas from areas.yaml,
// experiences from game-rules.yaml, "Ver mi ruta" and the progress it creates.
import type { Experience } from "@blueprint/scenario-schema";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe, { type RunOptions } from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { PROGRESS_SCHEMA_VERSION } from "../../progress/progress-schema";
import { useProgressStore } from "../../progress/progress-store";
import { bundle } from "../play/testing/game-fixture";
import { newProgress, storedProgress, storeProgress } from "../../testing/progress-fixture";

const HEADLINE = "Entrená tu criterio para diseñar en la nube.";

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

const renderWelcome = async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/bienvenida"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findByRole("radiogroup", { name: "¿Cuál es tu experiencia?" });
  return user;
};

const submit = () => screen.getByRole("button", { name: /Ver mi ruta/ });

describe("onboarding", () => {
  it("replaces the global header with its own brand and has no step indicator", async () => {
    await renderWelcome();
    expect(screen.getByRole("heading", { level: 1, name: HEADLINE })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Armemos tu ruta de aprendizaje" }));
    expect(screen.queryByRole("navigation", { name: "Principal" })).toBeNull();
    expect(screen.queryByText(/1 de 2/)).toBeNull();
  });

  it("lists the areas of areas.yaml as toggles", async () => {
    await renderWelcome();
    const group = screen.getByRole("group", { name: "¿Qué áreas querés practicar?" });
    const toggles = within(group).getAllByRole("button");
    expect(toggles.map((toggle) => toggle.textContent)).toEqual(
      bundle.index.areas.map((area) => area.name),
    );
    expect(toggles.every((toggle) => toggle.getAttribute("aria-pressed") === "false")).toBe(true);
  });

  it("offers the four experiences of RF-ONB-02 as a radio group", async () => {
    const user = await renderWelcome();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((radio) => radio.getAttribute("aria-labelledby") !== null)).toEqual([
      true,
      true,
      true,
      true,
    ]);
    const names = ["Recién empiezo", "Uso AWS", "Diseño arquitecturas", "Experto"];
    for (const name of names) expect(screen.getByRole("radio", { name })).toBeTruthy();
    expect(screen.queryByText("Uso la nube")).toBeNull();

    // Arrow keys move between the options (roving focus) and Space chooses.
    await user.click(screen.getByRole("radio", { name: "Recién empiezo" }));
    await user.keyboard("{ArrowDown}");
    const awsUser = screen.getByRole("radio", { name: "Uso AWS" });
    expect(document.activeElement).toBe(awsUser);
    await user.keyboard(" ");
    expect(awsUser.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps «Ver mi ruta» disabled, but focusable and explained, until an area and an experience are chosen", async () => {
    const user = await renderWelcome();
    const button = submit();
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.hasAttribute("disabled")).toBe(false);
    const reason = "Elegí al menos un área y tu experiencia para continuar.";
    expect(button.getAttribute("aria-describedby")).not.toBeNull();
    expect(
      document.getElementById(button.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe(reason);

    await user.click(screen.getByRole("button", { name: "Redes" }));
    expect(screen.getByRole("button", { name: "Redes" }).getAttribute("aria-pressed")).toBe("true");
    expect(submit().getAttribute("aria-disabled")).toBe("true");
    // Pressing it does nothing yet.
    await user.click(submit());
    expect(storedProgress()).toBeNull();

    await user.click(screen.getByRole("radio", { name: "Experto" }));
    expect(submit().getAttribute("aria-disabled")).toBe("false");
    expect(submit().getAttribute("aria-describedby")).toBeNull();

    // Unpressing the only area disables it again.
    await user.click(screen.getByRole("button", { name: "Redes" }));
    expect(submit().getAttribute("aria-disabled")).toBe("true");
  });

  it.each<[Experience, string, number[]]>([
    ["beginner", "Recién empiezo", [100]],
    ["aws-user", "Uso AWS", [100, 200]],
    ["architect", "Diseño arquitecturas", [100, 200, 300]],
    ["expert", "Experto", [100, 200, 300, 400]],
  ])(
    "creates the progress of «%s» with game-engine, saves it and opens the scenarios",
    async (experience, label, levels) => {
      const user = await renderWelcome();
      await user.click(screen.getByRole("button", { name: "Serverless" }));
      await user.click(screen.getByRole("button", { name: "Seguridad" }));
      await user.click(screen.getByRole("radio", { name: label }));
      await act(() => user.click(submit()));

      expect(await screen.findByRole("heading", { level: 1, name: "Escenarios" })).toBeTruthy();
      const progress = storedProgress();
      expect(progress).toEqual(newProgress(experience, ["serverless", "security"]));
      expect([...new Set(progress?.unlocked.map((u) => u.level))]).toEqual(levels);
      expect(progress?.xp).toBe(0);
    },
  );

  it("is skipped by a player who already has progress", async () => {
    storeProgress(newProgress("beginner"));
    render(
      <MemoryRouter initialEntries={["/bienvenida"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Escenarios" })).toBeTruthy();
  });

  it("is not shown while the stored progress is incompatible", async () => {
    const newer = JSON.stringify({ schemaVersion: PROGRESS_SCHEMA_VERSION + 1, progress: {} });
    localStorage.setItem(PROGRESS_STORAGE_KEY, newer);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <MemoryRouter initialEntries={["/bienvenida"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(await screen.findByText(/mientras tanto no se puede empezar de nuevo/)).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver mi ruta/ })).toBeNull();
    expect(localStorage.getItem(PROGRESS_STORAGE_KEY)).toBe(newer);
  });

  it("has no axe violations, before and after choosing", async () => {
    const user = await renderWelcome();
    const options: RunOptions = {
      resultTypes: ["violations"],
      // jsdom does not compute styles: contrast is checked on the tokens (docs/design).
      rules: { "color-contrast": { enabled: false } },
    };
    expect((await axe.run(document.body, options)).violations).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Redes" }));
    await user.click(screen.getByRole("radio", { name: "Uso AWS" }));
    expect((await axe.run(document.body, options)).violations).toEqual([]);
  });
});
