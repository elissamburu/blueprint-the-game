// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /escenarios/:id: the game screen of the scenario, behind the gate that loads it and says why a
// scenario cannot be played yet (ScenarioGate).
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { Loading } from "../../content/RequireContent";
import { ScenarioGate } from "./ScenarioGate";

/** React Flow and @dnd-kit are heavy: the game screen is its own chunk (ADR-0004, RNF-03). */
const GameScreen = lazy(() => import("./GameScreen"));

export default function PlayPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  return (
    <ScenarioGate id={id}>
      {(scenario, bundle) => (
        <Suspense fallback={<Loading label={t("play.board.loading")} />}>
          <GameScreen scenario={scenario} bundle={bundle} />
        </Suspense>
      )}
    </ScenarioGate>
  );
}
