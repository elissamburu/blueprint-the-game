// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /escenarios/:id: the game screen of the scenario (@blueprint/play, with this app's GameHost),
// behind the gate that loads it and says why a scenario cannot be played yet (ScenarioGate).
import type { Scenario } from "@blueprint/scenario-schema";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import type { ContentBundle } from "../../content/load-bundle";
import { Loading } from "../../content/RequireContent";
import { useWebGameHost } from "./game-host";
import { ScenarioGate } from "./ScenarioGate";

/** React Flow and @dnd-kit are heavy: the game screen is its own chunk (ADR-0004, RNF-03). */
const GameScreen = lazy(() => import("@blueprint/play/game-screen"));

export default function PlayPage() {
  const { id = "" } = useParams();
  return (
    <ScenarioGate id={id}>
      {(scenario, bundle) => <WebGame scenario={scenario} bundle={bundle} />}
    </ScenarioGate>
  );
}

function WebGame({ scenario, bundle }: { scenario: Scenario; bundle: ContentBundle }) {
  const { t } = useTranslation();
  const host = useWebGameHost(scenario, bundle);
  return (
    <Suspense fallback={<Loading label={t("play.board.loading")} />}>
      <GameScreen scenario={scenario} bundle={bundle} host={host} />
    </Suspense>
  );
}
