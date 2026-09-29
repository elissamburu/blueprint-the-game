// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Board of the game screen, in its own chunk: React Flow loads only when a scenario opens
// (ADR-0004, RNF-03). For now read-only: the palette and the feedback arrive with RF-PLAY-04..08.
import { Diagram } from "@blueprint/diagram";
import type { BundleCatalog, Scenario } from "@blueprint/scenario-schema";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { createServiceLookup } from "./board";

export default function ScenarioBoard({
  scenario,
  catalog,
}: {
  scenario: Scenario;
  catalog: BundleCatalog;
}) {
  const { t } = useTranslation();
  const services = useMemo(() => createServiceLookup(catalog.services), [catalog]);
  return (
    <Diagram
      diagram={scenario.diagram}
      services={services}
      label={t("play.board.label", { title: scenario.title })}
      className="h-[min(78vh,820px)] min-h-[520px] overflow-hidden rounded-lg border bg-card"
    />
  );
}
