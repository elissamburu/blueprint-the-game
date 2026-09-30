// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The listing through the real routes (RF-NAV-01..05): redirect, filters, recommended band,
// best results, status and locks, all against the real bundle and a progress made by game-engine.
import type { PlayerProgress } from "@blueprint/game-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../../app/App";
import { useContentStore } from "../../content/content-store";
import { bundleFiles, fetchFrom } from "../../content/testing/bundle-fixture";
import "../../i18n";
import { PROGRESS_STORAGE_KEY } from "../../progress/local-storage-progress-repository";
import { PROGRESS_SCHEMA_VERSION } from "../../progress/progress-schema";
import { useProgressStore } from "../../progress/progress-store";
import { newProgress, storeProgress } from "../../testing/progress-fixture";
import { mockReactFlowLayout } from "../../testing/react-flow-mocks";

const STATIC = "El sitio institucional de una ONG, seguro y rápido en todo el mundo";
const PDF = "Comprobantes en PDF para un estudio contable";
const VPC = "Una aplicación en subredes privadas que no puede salir a internet";

beforeEach(() => {
  useContentStore.setState(useContentStore.getInitialState(), true);
  useProgressStore.setState(useProgressStore.getInitialState(), true);
  localStorage.clear();
  mockReactFlowLayout();
  vi.stubGlobal("fetch", fetchFrom(bundleFiles(["published", "beta", "draft"])));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderListing = async (progress: PlayerProgress | null) => {
  if (progress !== null) storeProgress(progress);
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/escenarios"]}>
      <AppRoutes />
    </MemoryRouter>,
  );
  await screen.findAllByRole("article");
  return user;
};

const card = (title: string) => {
  const article = screen
    .getAllByRole("article")
    .find((a) => within(a).queryByRole("heading", { level: 2, name: title }) !== null);
  if (article === undefined) throw new Error(`no card for ${title}`);
  return article;
};

const titles = () =>
  screen
    .getAllByRole("article")
    .map((article) => within(article).getByRole("heading", { level: 2 }).textContent);

/** A player who completed the static website with an orange and started the PDF scenario. */
const played = (): PlayerProgress => {
  const progress = newProgress("expert", ["networking"]);
  return {
    ...progress,
    xp: 400,
    started: ["serverless-pdf-processing", "static-website-https"],
    best: {
      "static-website-https": {
        version: 1,
        level: 100,
        areas: ["networking", "storage"],
        score: 350,
        maxScore: 400,
        xp: 350,
        hintsUsed: 0,
        perfect: false,
        allOptimal: false,
      },
    },
  };
};

describe("scenario listing", () => {
  it("sends a player without progress to the onboarding", async () => {
    render(
      <MemoryRouter initialEntries={["/escenarios"]}>
        <AppRoutes />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Entrená tu criterio para diseñar en la nube.",
      }),
    ).toBeTruthy();
  });

  it("lists the scenarios, easiest first, and tags drafts and betas", async () => {
    await renderListing(newProgress("expert"));
    expect(titles()).toEqual([STATIC, PDF, VPC]);
    expect(within(card(PDF)).getByText("Beta")).toBeTruthy();
    expect(within(card(VPC)).getByText("Borrador")).toBeTruthy();
    expect(screen.getByText("3 escenarios")).toBeTruthy();
  });

  it("shows the header rank of the stored XP", async () => {
    await renderListing({ ...newProgress("beginner"), xp: 1200 });
    expect(screen.getByText("Constructor")).toBeTruthy();
    expect(screen.queryByText(/Nv\./)).toBeNull();
  });

  it("shows the best result and the status of each scenario", async () => {
    await renderListing(played());
    expect(within(card(STATIC)).getByText("Mejor resultado: 350 de 400 puntos")).toBeTruthy();
    expect(within(card(STATIC)).getByText("Completado")).toBeTruthy();
    expect(
      within(card(STATIC)).getByRole("link", { name: `Volver a jugar «${STATIC}»` }),
    ).toBeTruthy();
    expect(within(card(PDF)).getByText("En curso")).toBeTruthy();
    expect(within(card(VPC)).getByText("Nuevo")).toBeTruthy();
    expect(within(card(VPC)).getByRole("link", { name: `Jugar «${VPC}»` })).toBeTruthy();
  });

  it("shows the icon of the main area of each scenario", async () => {
    await renderListing(newProgress("expert"));
    expect(card(STATIC).querySelector("svg.lucide-network")).not.toBeNull();
    expect(card(PDF).querySelector("svg.lucide-zap")).not.toBeNull();
    expect(card(PDF).querySelector("svg.lucide-cloud")).toBeNull();
  });
});

describe("filters", () => {
  it("filter by level, area and status, and the count follows", async () => {
    const user = await renderListing(played());
    const level = screen.getByRole("combobox", { name: "Nivel" });
    const area = screen.getByRole("combobox", { name: "Área" });
    const status = screen.getByRole("combobox", { name: "Estado" });

    await user.selectOptions(level, "Nivel 300");
    expect(titles()).toEqual([VPC]);
    expect(screen.getByText("1 escenario")).toBeTruthy();

    await user.selectOptions(level, "Todos");
    await user.selectOptions(area, "Almacenamiento");
    expect(titles()).toEqual([STATIC, PDF]);

    await user.selectOptions(status, "En curso");
    expect(titles()).toEqual([PDF]);

    await user.selectOptions(area, "Todas");
    await user.selectOptions(status, "Completado");
    expect(titles()).toEqual([STATIC]);

    await user.selectOptions(status, "Completado en verde");
    expect(screen.queryAllByRole("article")).toEqual([]);
    expect(screen.getByText("Ningún escenario coincide con los filtros.")).toBeTruthy();

    await user.selectOptions(status, "Nuevo");
    expect(titles()).toEqual([VPC]);
  });
});

describe("recommended band", () => {
  it("recommends a scenario of an area of interest at the highest open level", async () => {
    await renderListing(newProgress("aws-user", ["serverless"]));
    const region = screen.getByRole("region", { name: PDF });
    expect(within(region).getByText("Recomendado para vos")).toBeTruthy();
    const link = within(region).getByRole("link", { name: `Empezar escenario «${PDF}»` });
    expect(link.getAttribute("href")).toBe("/escenarios/serverless-pdf-processing");
  });

  it("offers to continue a started scenario", async () => {
    const progress = newProgress("beginner", ["networking"]);
    await renderListing({ ...progress, started: ["static-website-https"] });
    expect(
      within(screen.getByRole("region", { name: STATIC })).getByRole("link", {
        name: `Continuar escenario «${STATIC}»`,
      }),
    ).toBeTruthy();
  });

  it("is not shown when nothing is left to recommend", async () => {
    // Networking at 100 is completed; its 300 is locked for a beginner.
    const progress = played();
    await renderListing({ ...progress, experience: "beginner", unlocked: [] });
    expect(screen.queryByText("Recomendado para vos")).toBeNull();
  });
});

describe("locks", () => {
  it("locks the scenarios above the open levels and says why, without a play link", async () => {
    await renderListing(newProgress("beginner"));
    const pdf = card(PDF);
    expect(within(pdf).getByText("Bloqueado")).toBeTruthy();
    expect(
      within(pdf).getByText("Completá escenarios de nivel 100 en Almacenamiento."),
    ).toBeTruthy();
    expect(within(pdf).queryByRole("link")).toBeNull();
    expect(within(card(VPC)).getByText("Completá escenarios de nivel 100 en Redes.")).toBeTruthy();
    expect(within(card(STATIC)).queryByText("Bloqueado")).toBeNull();
    expect(within(card(STATIC)).getByRole("link", { name: `Jugar «${STATIC}»` })).toBeTruthy();
  });

  it("names no area when the next level of the area has no scenarios: any area counts", async () => {
    // The static website opened networking 200, which has no scenarios: the PDF one counts.
    await renderListing({ ...played(), experience: "beginner", unlocked: [] });
    expect(within(card(VPC)).getByText("Completá escenarios de nivel 200.")).toBeTruthy();
  });

  it("locks nothing and shows no player data while the progress is incompatible", async () => {
    localStorage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ schemaVersion: PROGRESS_SCHEMA_VERSION + 1, progress: {} }),
    );
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await renderListing(null);
    expect(screen.queryByText("Bloqueado")).toBeNull();
    expect(screen.queryByText("Recomendado para vos")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Estado" })).toBeNull();
    expect(screen.getAllByRole("link", { name: /^Jugar/ })).toHaveLength(3);
  });
});

describe("accessibility", () => {
  it("has no axe violations with results, locks and the recommended band", async () => {
    // Beginner: the PDF scenario is open through storage and recommended; the VPC one is locked.
    await renderListing({
      ...played(),
      experience: "beginner",
      interests: ["networking", "storage"],
      unlocked: [],
    });
    expect(screen.getByRole("region", { name: PDF })).toBeTruthy();
    expect(within(card(VPC)).getByText("Bloqueado")).toBeTruthy();
    const results = await axe.run(document.body, {
      resultTypes: ["violations"],
      // jsdom does not compute styles: contrast is checked on the tokens (docs/design).
      rules: { "color-contrast": { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
