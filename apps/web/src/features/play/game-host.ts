// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The web game's GameHost (ADR-0025): what the game screen of @blueprint/play needs from this app.
// The first move marks the scenario "en curso" and "Terminar" saves the result and goes to the
// summary, both in the local progress; the screen takes the immersive layout, the icons of
// public/icons and the routes of this router.
import { markScenarioStarted } from "@blueprint/game-engine";
import type { GameHost } from "@blueprint/play";
import type { Scenario } from "@blueprint/scenario-schema";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useImmersiveLayout } from "../../app/immersive";
import type { ContentBundle } from "../../content/load-bundle";
import { useProgressStore } from "../../progress/progress-store";
import { serviceIconSrc } from "../../service-icons";
import { finishScenario, summaryState } from "./finish";
import { repositoryUrl, reportIssueUrl } from "./report-issue";

const REPOSITORY = repositoryUrl(import.meta.env.VITE_REPO_URL);

export const useWebGameHost = (scenario: Scenario, bundle: ContentBundle): GameHost => {
  const { t } = useTranslation(["translation", "play"]);
  const navigate = useNavigate();
  return useMemo(
    (): GameHost => ({
      iconSrc: serviceIconSrc,
      // Without progress nothing is saved, as with the result.
      onStarted: (scenarioId) => {
        const { progress, replace } = useProgressStore.getState();
        if (progress === null) return;
        const next = markScenarioStarted(progress, scenarioId);
        if (next !== progress) void replace(next);
      },
      onFinish: async (session) => {
        const { progress, replace } = useProgressStore.getState();
        const outcome = await finishScenario({
          session,
          progress,
          rules: bundle.rules,
          scenarios: bundle.index.scenarios,
          save: replace,
        });
        // The summary shows and announces the XP, the rank and the unlocks (and says when
        // nothing was saved): toasts on top of it would be read twice.
        void navigate(`/escenarios/${scenario.id}/resumen`, { state: summaryState(outcome) });
      },
      exit: { label: t("play:back"), href: "/escenarios" },
      reportIssueUrl: (slotId) =>
        reportIssueUrl(REPOSITORY, {
          scenarioId: scenario.id,
          version: scenario.version,
          slotId: slotId ?? null,
        }),
      printHref: (scenarioId) => `/escenarios/${scenarioId}/imprimir`,
      useLayout: useImmersiveLayout,
    }),
    [scenario, bundle, navigate, t],
  );
};
