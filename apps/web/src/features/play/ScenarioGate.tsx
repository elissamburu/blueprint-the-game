// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Gate of the pages of one scenario (the game, RF-PLAY-01, and its printable version, RF-PLAY-16):
// loads and validates the scenario, then hands it to the page. A scenario the player cannot play
// yet (isScenarioPlayable of game-engine) shows why instead; one that is not listed, a not found.
// Without progress it opens anyway, without saving.
import { lockReason, type LockReason } from "@blueprint/game-engine";
import type { BundleIndexEntry, Scenario } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { useContentStore, type ScenarioLookup } from "../../content/content-store";
import type { ContentBundle } from "../../content/load-bundle";
import { ContentErrorView, Loading, RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";
import { LockReasonText } from "../catalog-browse/LockReasonText";
import { usePlayerProgress } from "../../progress/use-player-progress";

/** What the page shows once the scenario is loaded and the player may open it. */
type RenderScenario = (scenario: Scenario, bundle: ContentBundle) => ReactNode;

export function ScenarioGate({ id, children }: { id: string; children: RenderScenario }) {
  return (
    <RequireContent>
      {(bundle) => (
        <PlayableGate key={id} id={id} bundle={bundle}>
          {children}
        </PlayableGate>
      )}
    </RequireContent>
  );
}

function PlayableGate({
  id,
  bundle,
  children,
}: {
  id: string;
  bundle: ContentBundle;
  children: RenderScenario;
}) {
  const { t } = useTranslation();
  const status = useProgressStore((s) => s.status);
  const progress = usePlayerProgress(bundle);
  if (status !== "ready") return <Loading label={t("play.loading")} />;
  const entry = bundle.index.scenarios.find((s) => s.id === id);
  const lock =
    entry === undefined || progress === null
      ? null
      : lockReason(progress.unlocked, entry, bundle.index.scenarios);
  if (entry !== undefined && lock !== null) {
    return <LockedView scenario={entry} lock={lock} areas={bundle.index.areas} />;
  }
  return (
    <ScenarioLoader id={id} bundle={bundle}>
      {children}
    </ScenarioLoader>
  );
}

function LockedView({
  scenario,
  lock,
  areas,
}: {
  scenario: BundleIndexEntry;
  lock: LockReason;
  areas: ContentBundle["index"]["areas"];
}) {
  const { t } = useTranslation();
  usePageTitle(scenario.title);
  return (
    <PageShell>
      <PageHeading
        kicker={t("play.locked.kicker", { level: scenario.level })}
        title={t("play.locked.title")}
        description={t("play.locked.description", { title: scenario.title })}
      />
      <p className="mb-8 flex items-center gap-3 rounded-lg border bg-muted p-4 text-base font-semibold">
        <LockIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
        <LockReasonText lock={lock} areaName={(id) => areas.find((a) => a.id === id)?.name ?? id} />
      </p>
      <BackLink />
    </PageShell>
  );
}

function ScenarioLoader({
  id,
  bundle,
  children,
}: {
  id: string;
  bundle: ContentBundle;
  children: RenderScenario;
}) {
  const { t } = useTranslation();
  const loadScenario = useContentStore((s) => s.loadScenario);
  const [lookup, setLookup] = useState<ScenarioLookup | null>(null);
  useEffect(() => {
    let active = true;
    void loadScenario(id).then((result) => {
      if (active) setLookup(result);
    });
    return () => {
      active = false;
    };
  }, [id, loadScenario]);
  usePageTitle(lookup?.status === "ready" ? lookup.scenario.title : null);

  if (lookup === null) return <Loading label={t("play.loading")} />;
  switch (lookup.status) {
    case "error":
      return (
        <PageShell>
          <ContentErrorView error={lookup.error} />
        </PageShell>
      );
    case "not-found":
      return (
        <PageShell>
          <PageHeading
            kicker="404"
            title={t("play.notFound.title")}
            description={t("play.notFound.description", { id })}
          />
          <BackLink />
        </PageShell>
      );
    case "ready":
      return children(lookup.scenario, bundle);
  }
}

function BackLink() {
  const { t } = useTranslation();
  return (
    <Button asChild variant="outline">
      <Link to="/escenarios">
        <ArrowLeftIcon aria-hidden /> {t("play.back")}
      </Link>
    </Button>
  );
}
