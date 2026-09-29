// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Scenario listing (RF-NAV-01..05; docs/design/pantallas/02 and 03): the recommended band, the
// filters and a card per scenario with its best result, status and lock. Status, recommendation,
// playability and the lock reason come from game-engine: no unlock rule is decided here.
// Without progress the player goes to the onboarding, unless the stored progress is from a newer
// version of the game: then the listing shows the scenarios without the player's data.
// Lovable: Scenarios, .recommended-band, .recommend-visual, .filters-row, .scenario-grid,
// .scenario-card (blueprint-app.tsx, styles.css). Without "Meta diaria" (it is not a requirement).
import {
  lockReason,
  recommendedScenario,
  scenarioStatus,
  type BestResult,
  type PlayerProgress,
  type ScenarioStatus,
} from "@blueprint/game-engine";
import { LEVELS, type Area, type BundleIndexEntry } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ArrowRightIcon,
  CloudIcon,
  FilterIcon,
  Globe2Icon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { AREA_ICONS } from "../../area-icons";
import type { ContentBundle } from "../../content/load-bundle";
import { Loading, RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";
import { usePlayerProgress } from "../../progress/use-player-progress";
import {
  filterScenarios,
  NO_FILTERS,
  sortScenarios,
  type LevelFilter,
  type ScenarioFilters,
} from "./filters";
import { LockReasonText } from "./LockReasonText";
import { StatusBadge } from "./StatusBadge";
import { formatNumber } from "../../i18n/format";

export default function ScenariosPage() {
  const { t } = useTranslation();
  usePageTitle(t("scenarios.title"));
  const status = useProgressStore((s) => s.status);
  const hasProgress = useProgressStore((s) => s.progress !== null);
  const incompatible = useProgressStore((s) => s.incompatible);

  if (status !== "ready") return <Loading label={t("app.loading")} />;
  if (!hasProgress && !incompatible) return <Navigate to="/bienvenida" replace />;
  return (
    <PageShell>
      <PageHeading
        kicker={t("scenarios.kicker")}
        title={t("scenarios.title")}
        description={t("scenarios.description")}
      />
      <RequireContent>{(bundle) => <Listing bundle={bundle} />}</RequireContent>
    </PageShell>
  );
}

function Listing({ bundle }: { bundle: ContentBundle }) {
  const { t } = useTranslation();
  const progress = usePlayerProgress(bundle);
  const [filters, setFilters] = useState<ScenarioFilters>(NO_FILTERS);
  const { areas } = bundle.index;
  const sorted = useMemo(() => sortScenarios(bundle.index.scenarios), [bundle]);
  const recommended = useMemo(
    () => (progress === null ? null : recommendedScenario(progress, sorted)),
    [progress, sorted],
  );

  if (sorted.length === 0) {
    return <p className="text-muted-foreground">{t("scenarios.empty")}</p>;
  }
  const statusOf =
    progress === null ? null : (id: string): ScenarioStatus => scenarioStatus(progress, id);
  const visible = filterScenarios(sorted, filters, statusOf);
  const areaName = (id: string) => areas.find((area) => area.id === id)?.name ?? id;
  const usedAreas = areas.filter((area) => sorted.some((s) => s.areas.includes(area.id)));

  return (
    <>
      {recommended !== null && progress !== null && (
        <RecommendedBand scenario={recommended} status={scenarioStatus(progress, recommended.id)} />
      )}
      <Filters
        filters={filters}
        onChange={setFilters}
        areas={usedAreas}
        withStatus={progress !== null}
        count={visible.length}
      />
      {visible.length === 0 ? (
        <p className="text-muted-foreground">{t("scenarios.filters.none")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((scenario) => (
            <li key={scenario.id}>
              <ScenarioCard
                scenario={scenario}
                areaNames={scenario.areas.map(areaName)}
                progress={progress}
                scenarios={sorted}
                lockAreaName={areaName}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** Band of the recommended scenario (RF-NAV-02). The button is light on the blue (problem 2). */
function RecommendedBand({
  scenario,
  status,
}: {
  scenario: BundleIndexEntry;
  status: ScenarioStatus;
}) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid min-h-[240px] items-center overflow-hidden rounded-[10px] bg-blueprint p-6 text-primary-foreground md:grid-cols-[1.2fr_0.8fr] md:px-10 md:py-8"
    >
      <div className="max-w-[600px]">
        <p className="inline-flex items-center gap-[0.4rem] rounded-md bg-[color-mix(in_oklab,var(--primary-foreground)_16%,transparent)] px-2.5 py-0.5 text-sm font-semibold">
          <SparklesIcon aria-hidden className="size-4" />
          {t("scenarios.recommended.badge")}
        </p>
        <h2 id={`${id}-title`} className="mt-[1.1rem] mb-[0.55rem] text-[1.65rem]">
          {scenario.title}
        </h2>
        <p className="leading-[1.6] text-[color-mix(in_oklab,var(--primary-foreground)_85%,transparent)]">
          {scenario.summary}
        </p>
        <Button
          asChild
          className="mt-[1.4rem] bg-card text-blueprint shadow-none hover:bg-card/90 focus-visible:outline-primary-foreground"
        >
          <Link
            to={`/escenarios/${scenario.id}`}
            aria-label={t(
              status === "in-progress"
                ? "scenarios.recommended.continueLabel"
                : "scenarios.recommended.startLabel",
              { title: scenario.title },
            )}
          >
            {status === "in-progress"
              ? t("scenarios.recommended.continue")
              : t("scenarios.recommended.start")}
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      </div>
      <div aria-hidden="true" className="hidden items-center justify-center md:flex">
        <BandNode>
          <Globe2Icon />
        </BandNode>
        <span className="w-[42px] border-t-2 border-dashed border-[color-mix(in_oklab,var(--primary-foreground)_40%,transparent)]" />
        <BandNode>
          <CloudIcon />
        </BandNode>
        <span className="w-[42px] border-t-2 border-dashed border-[color-mix(in_oklab,var(--primary-foreground)_40%,transparent)]" />
        <BandNode>
          <ShieldCheckIcon />
        </BandNode>
      </div>
    </section>
  );
}

function BandNode({ children }: { children: ReactNode }) {
  return (
    <span className="grid size-[62px] place-items-center rounded-[9px] border border-[color-mix(in_oklab,var(--primary-foreground)_28%,transparent)] bg-[color-mix(in_oklab,var(--primary-foreground)_10%,transparent)] [&>svg]:size-6">
      {children}
    </span>
  );
}

const STATUSES: readonly ScenarioStatus[] = [
  "new",
  "in-progress",
  "completed-green",
  "completed-orange",
];

const selectClass =
  "h-10 rounded-md border bg-card py-2 pr-[1.8rem] pl-[0.65rem] text-sm text-foreground";

function Filters({
  filters,
  onChange,
  areas,
  withStatus,
  count,
}: {
  filters: ScenarioFilters;
  onChange: (filters: ScenarioFilters) => void;
  areas: readonly Area[];
  withStatus: boolean;
  count: number;
}) {
  const { t } = useTranslation();
  const id = useId();
  const labelClass =
    "flex items-center justify-between gap-[0.45rem] text-sm text-muted-foreground md:justify-start";
  return (
    <div
      role="group"
      aria-labelledby={`${id}-title`}
      className="mt-[2.4rem] mb-5 flex flex-col items-stretch gap-4 md:flex-row md:flex-wrap md:items-center"
    >
      <span id={`${id}-title`} className="flex items-center gap-[0.4rem] font-bold">
        <FilterIcon aria-hidden className="size-4" />
        {t("scenarios.filters.title")}
      </span>
      <label className={labelClass}>
        {t("scenarios.filters.level")}
        <select
          className={selectClass}
          value={filters.level}
          onChange={(event) =>
            onChange({
              ...filters,
              level:
                event.target.value === "all"
                  ? "all"
                  : (Number(event.target.value) as Exclude<LevelFilter, "all">),
            })
          }
        >
          <option value="all">{t("scenarios.filters.allLevels")}</option>
          {LEVELS.map((level) => (
            <option key={level} value={level}>
              {t("scenarios.filters.levelOption", { level })}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        {t("scenarios.filters.area")}
        <select
          className={selectClass}
          value={filters.area}
          onChange={(event) => onChange({ ...filters, area: event.target.value })}
        >
          <option value="all">{t("scenarios.filters.allAreas")}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </label>
      {withStatus && (
        <label className={labelClass}>
          {t("scenarios.filters.status")}
          <select
            className={selectClass}
            value={filters.status}
            onChange={(event) =>
              onChange({
                ...filters,
                status:
                  event.target.value === "all" ? "all" : (event.target.value as ScenarioStatus),
              })
            }
          >
            <option value="all">{t("scenarios.filters.allStatuses")}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`scenarios.status.${status}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <p aria-live="polite" className="text-sm text-muted-foreground md:ml-auto">
        {t("scenarios.count", { count })}
      </p>
    </div>
  );
}

function ScenarioCard({
  scenario,
  areaNames,
  progress,
  scenarios,
  lockAreaName,
}: {
  scenario: BundleIndexEntry;
  areaNames: readonly string[];
  progress: PlayerProgress | null;
  scenarios: readonly BundleIndexEntry[];
  lockAreaName: (id: string) => string;
}) {
  const { t } = useTranslation();
  const titleId = `scenario-${scenario.id}`;
  // Without progress (incompatible) the game is played without saving: nothing is locked.
  const lock = progress === null ? null : lockReason(progress.unlocked, scenario, scenarios);
  const status = progress === null ? null : scenarioStatus(progress, scenario.id);
  const best = progress?.best[scenario.id];
  const mainArea = scenario.areas[0];
  const Icon = mainArea === undefined ? undefined : AREA_ICONS[mainArea];
  const completed = status === "completed-green" || status === "completed-orange";
  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "flex h-full min-h-[340px] flex-col rounded-lg border p-[1.3rem]",
        lock === null
          ? "bg-card transition-[transform,box-shadow] duration-200 hover:-translate-y-[3px] hover:shadow-[0_15px_35px_color-mix(in_oklab,var(--foreground)_8%,transparent)]"
          : "bg-muted",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <LevelBadge level={scenario.level} className="text-sm" />
          <StatusBadge status={scenario.status} className="text-sm" />
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {best !== undefined && <BestScore best={best} />}
          {lock !== null ? (
            <span className="text-muted-foreground">
              <LockIcon aria-hidden className="size-[17px]" />
              <span className="sr-only">{t("scenarios.locked")}</span>
            </span>
          ) : (
            status !== null && <ProgressBadge status={status} />
          )}
        </span>
      </div>
      {Icon !== undefined && (
        <span
          aria-hidden="true"
          className={cn(
            "mt-[1.3rem] grid size-[42px] place-items-center rounded-[7px]",
            lock === null ? "bg-blueprint-soft text-primary" : "bg-card text-muted-foreground",
          )}
        >
          <Icon className="size-5" />
        </span>
      )}
      <h2 id={titleId} className="mt-[0.8rem] text-[1.12rem] leading-[1.35]">
        {scenario.title}
      </h2>
      <p className="mt-[0.55rem] leading-[1.55] text-muted-foreground">{scenario.summary}</p>
      <ul aria-label={t("scenarios.areas")} className="mt-4 flex flex-wrap gap-[0.4rem]">
        {areaNames.map((name) => (
          <li key={name}>
            <Badge variant="secondary" className="text-sm">
              {name}
            </Badge>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4 text-sm text-muted-foreground">
        <span>{t("scenarios.minutes", { count: scenario.estimatedMinutes })}</span>
        {lock !== null ? (
          <p className="text-right font-semibold text-foreground">
            <LockReasonText lock={lock} areaName={lockAreaName} />
          </p>
        ) : (
          <Button asChild variant="outline">
            <Link
              to={`/escenarios/${scenario.id}`}
              aria-label={t(completed ? "scenarios.replayLabel" : "scenarios.playLabel", {
                title: scenario.title,
              })}
            >
              {t(completed ? "scenarios.replay" : "scenarios.play")} <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </article>
  );
}

function BestScore({ best }: { best: BestResult }) {
  const { t } = useTranslation();
  return (
    <span className="flex items-center gap-[0.3rem] text-sm font-extrabold text-warning">
      <TrophyIcon aria-hidden className="size-[17px]" />
      <span aria-hidden="true">{formatNumber(best.score)}</span>
      <span className="sr-only">
        {t("scenarios.best", {
          score: formatNumber(best.score),
          max: formatNumber(best.maxScore),
        })}
      </span>
    </span>
  );
}

const PROGRESS_BADGE: Record<ScenarioStatus, string> = {
  new: "border-transparent bg-secondary text-secondary-foreground",
  "in-progress": "border-primary bg-card text-primary",
  "completed-green": "border-transparent bg-success-soft text-success",
  "completed-orange": "border-transparent bg-warning-soft text-warning",
};

function ProgressBadge({ status }: { status: ScenarioStatus }) {
  const { t } = useTranslation();
  return (
    <Badge variant="outline" className={cn("text-sm uppercase", PROGRESS_BADGE[status])}>
      {t(`scenarios.status.${status}`)}
    </Badge>
  );
}
