// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game screen. For now it loads and validates the scenario and shows its heading; the board,
// palette and feedback arrive with RF-PLAY.
import { Button } from "@blueprint/ui/components/button";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { ArrowLeftIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { useContentStore, type ScenarioLookup } from "../../content/content-store";
import { ContentErrorView, Loading, RequireContent } from "../../content/RequireContent";
import { StatusBadge } from "../catalog-browse/StatusBadge";

export default function PlayPage() {
  const { id = "" } = useParams();
  return (
    <PageShell>
      <RequireContent>{() => <ScenarioLoader key={id} id={id} />}</RequireContent>
    </PageShell>
  );
}

function ScenarioLoader({ id }: { id: string }) {
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
      return <ContentErrorView error={lookup.error} />;
    case "not-found":
      return (
        <>
          <PageHeading
            kicker="404"
            title={t("play.notFound.title")}
            description={t("play.notFound.description", { id })}
          />
          <BackLink />
        </>
      );
    case "ready": {
      const { scenario } = lookup;
      return (
        <>
          <div className="mb-3 flex items-center gap-3">
            <LevelBadge level={scenario.level} variant="solid" />
            <StatusBadge status={scenario.status} />
          </div>
          <PageHeading
            kicker={t("nav.scenarios")}
            title={scenario.title}
            description={scenario.summary}
          />
          <p className="mb-6 rounded-lg border border-dashed p-6 text-muted-foreground">
            {t("play.underConstruction")}
          </p>
          <BackLink />
        </>
      );
    }
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
