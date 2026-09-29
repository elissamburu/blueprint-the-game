// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scenario listing (docs/design/pantallas/03). This PR lists the scenarios of the bundle; the
// filters, recommended band, unlocks and best results arrive with RF-NAV-01..04.
import type { Area, BundleIndexEntry } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { RequireContent } from "../../content/RequireContent";
import { StatusBadge } from "./StatusBadge";

export default function ScenariosPage() {
  const { t } = useTranslation();
  usePageTitle(t("scenarios.title"));
  return (
    <PageShell>
      <PageHeading
        kicker={t("scenarios.kicker")}
        title={t("scenarios.title")}
        description={t("scenarios.description")}
      />
      <RequireContent>
        {({ index }) => <ScenarioList scenarios={index.scenarios} areas={index.areas} />}
      </RequireContent>
    </PageShell>
  );
}

function ScenarioList({
  scenarios,
  areas,
}: {
  scenarios: readonly BundleIndexEntry[];
  areas: readonly Area[];
}) {
  const { t } = useTranslation();
  if (scenarios.length === 0) {
    return <p className="text-muted-foreground">{t("scenarios.empty")}</p>;
  }
  const areaName = new Map(areas.map((area) => [area.id, area.name]));
  // Easiest first, as in the design; filters and recommendations come with RF-NAV-01/02.
  const sorted = [...scenarios].sort(
    (a, b) => a.level - b.level || a.title.localeCompare(b.title, "es"),
  );
  return (
    <>
      <p className="mb-5 text-right text-[0.8rem] text-muted-foreground">
        {t("scenarios.count", { count: scenarios.length })}
      </p>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sorted.map((scenario) => (
          <li key={scenario.id}>
            <ScenarioCard
              scenario={scenario}
              areaNames={scenario.areas.map((id) => areaName.get(id) ?? id)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

function ScenarioCard({
  scenario,
  areaNames,
}: {
  scenario: BundleIndexEntry;
  areaNames: readonly string[];
}) {
  const { t } = useTranslation();
  const titleId = `scenario-${scenario.id}`;
  return (
    <article
      aria-labelledby={titleId}
      className="flex h-full min-h-[300px] flex-col rounded-lg border bg-card p-[1.3rem] transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_15px_35px_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
    >
      <div className="flex items-center justify-between gap-3">
        <LevelBadge level={scenario.level} />
        <StatusBadge status={scenario.status} />
      </div>
      <h2 id={titleId} className="mt-5 text-[1.12rem] leading-[1.35]">
        {scenario.title}
      </h2>
      <p className="mt-[0.55rem] text-[0.83rem] leading-[1.55] text-muted-foreground">
        {scenario.summary}
      </p>
      <ul aria-label={t("scenarios.areas")} className="mt-4 flex flex-wrap gap-[0.4rem]">
        {areaNames.map((name) => (
          <li key={name}>
            <Badge variant="secondary">{name}</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-[0.75rem] text-muted-foreground">
        <span>{t("scenarios.minutes", { count: scenario.estimatedMinutes })}</span>
        <Button asChild variant="outline">
          <Link
            to={`/escenarios/${scenario.id}`}
            aria-label={t("scenarios.playLabel", { title: scenario.title })}
          >
            {t("scenarios.play")} <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
    </article>
  );
}
