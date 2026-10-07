// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /escenarios/:id/resumen (RF-PLAY-09, RF-PLAY-13, RF-PLAY-14, RF-GAM-10; docs/design, capturas
// 09–11 and problemas 16–20). Slots whose solution was viewed are reviewed as "Solución vista"
// with 0 points, and the hero says the scenario was completed that way (completed, not green). The result arrives through the navigation state, validated at the boundary;
// the review, the counts and every number come from game-engine. No badges: they are F4.
// The title takes the focus when the page opens and the XP, rank and unlocks are announced in a
// polite live region (the game screen does not toast them, so they are read once).
// Motion (RF-PLAY-17): the trophy and each achievement scale in, and a rank up or an unlocked
// level throws decorative confetti once; with reduced motion they only fade and there is no
// confetti.
// Lovable: Summary, .celebration-band, .burst, .score-summary, .summary-content, .new-badge,
// .review-heading, .answer-list, .summary-actions (blueprint-app.tsx, styles.css).
import {
  reviewCounts,
  scenarioReview,
  type ProgressEvent,
  type SlotReview,
} from "@blueprint/game-engine";
import { entryIcon, InlineMarkdown } from "@blueprint/play";
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { GradeBadge, type SlotGrade } from "@blueprint/ui/components/grade-badge";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { motionClass } from "@blueprint/ui/lib/motion";
import { useReducedMotion } from "@blueprint/ui/lib/use-reduced-motion";
import { formatNumber } from "@blueprint/ui/lib/format";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ArrowRightIcon,
  AwardIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  EyeIcon,
  FlagIcon,
  LockOpenIcon,
  MinusIcon,
  PrinterIcon,
  RotateCcwIcon,
  SparklesIcon,
  TargetIcon,
  TrophyIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { useContentStore, type ScenarioLookup } from "../../content/content-store";
import type { ContentBundle } from "../../content/load-bundle";
import { ContentErrorView, Loading, RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";
import { serviceIconSrc } from "../../service-icons";
import { areaList, SummaryStateSchema, type SummaryState } from "./finish";
import { repositoryUrl, reportIssueUrl } from "./report-issue";

const REPOSITORY = repositoryUrl(import.meta.env.VITE_REPO_URL);
/** Time between focusing the title and filling the live region. */
const ANNOUNCE_DELAY_MS = 150;

export default function SummaryPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const parsed = SummaryStateSchema.safeParse(useLocation().state);
  usePageTitle(t("play.summary.title"));
  if (!parsed.success) return <MissingResult id={id} />;
  return (
    <RequireContent>
      {(bundle) => <SummaryLoader key={id} id={id} state={parsed.data} bundle={bundle} />}
    </RequireContent>
  );
}

/** Opened without a result (a new visit to the URL): nothing to summarize. */
function MissingResult({ id }: { id: string }) {
  const { t } = useTranslation();
  return (
    <PageShell>
      <PageHeading
        kicker={t("play.summary.kicker")}
        title={t("play.summary.title")}
        description={t("play.summary.missing")}
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/escenarios">{t("play.summary.browse")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/escenarios/${id}`}>{t("play.summary.replay")}</Link>
        </Button>
      </div>
    </PageShell>
  );
}

function SummaryLoader({
  id,
  state,
  bundle,
}: {
  id: string;
  state: SummaryState;
  bundle: ContentBundle;
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

  if (lookup === null) return <Loading label={t("play.summary.loading")} />;
  switch (lookup.status) {
    case "error":
      return (
        <PageShell>
          <ContentErrorView error={lookup.error} />
        </PageShell>
      );
    case "not-found":
      return <MissingResult id={id} />;
    case "ready":
      return <SummaryView scenario={lookup.scenario} state={state} bundle={bundle} />;
  }
}

function SummaryView({
  scenario,
  state,
  bundle,
}: {
  scenario: Scenario;
  state: SummaryState;
  bundle: ContentBundle;
}) {
  const { t } = useTranslation();
  const services = useMemo(
    () => new Map<string, Service>(bundle.catalog.services.map((s) => [s.id, s])),
    [bundle],
  );
  const review = useMemo(() => scenarioReview(scenario, state.slots), [scenario, state.slots]);
  const counts = reviewCounts(review);
  const achievements = state.events.filter((e) => e.type !== "xpGained");
  const gained = state.comparison?.gained ?? 0;
  const reducedMotion = useReducedMotion();

  // Focus on the title, then the announcement: screen readers read a live region that gets its
  // text after it is rendered, not one rendered with its text.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const announcementText = [
    state.saved
      ? gained > 0
        ? t("play.summary.announce", { xp: formatNumber(gained) })
        : t("play.summary.announceNone")
      : null,
    ...achievements.map((event) => achievementText(t, event, bundle.index.areas)),
  ]
    .filter((text) => text !== null)
    .join(" ");
  useEffect(() => {
    titleRef.current?.focus();
    // After the title is read.
    const timer = window.setTimeout(() => setAnnouncement(announcementText), ANNOUNCE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [announcementText]);

  const reportUrl = reportIssueUrl(REPOSITORY, {
    scenarioId: scenario.id,
    version: scenario.version,
    slotId: null,
  });

  return (
    <div className="pb-24">
      <section className="relative overflow-hidden bg-blueprint px-4 pt-12 pb-10 text-center text-primary-foreground md:px-8 md:pt-16 md:pb-12">
        {achievements.length > 0 && !reducedMotion && <Confetti />}
        <div
          aria-hidden="true"
          className={cn(
            "relative mx-auto mb-4 grid size-[74px] place-items-center rounded-full bg-warning shadow-[0_0_0_10px_color-mix(in_oklab,var(--warning)_25%,transparent)]",
            motionClass("celebrate", reducedMotion),
          )}
        >
          <TrophyIcon className="size-[34px]" />
        </div>
        <Badge className="gap-[0.4rem] border-0 bg-primary-foreground/15 text-sm text-primary-foreground uppercase shadow-none hover:bg-primary-foreground/15 [&>svg]:size-[14px]">
          <SparklesIcon aria-hidden />
          {t("play.summary.kicker")}
        </Badge>
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="mt-[0.9rem] text-[2.2rem] leading-tight outline-none md:text-[2.5rem]"
        >
          {t("play.summary.title")}
        </h1>
        <p className="mx-auto mt-2 max-w-[640px] text-lg opacity-90">{scenario.title}</p>
        {counts.revealed > 0 && (
          <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-md border border-dashed border-primary-foreground/60 px-3 py-1 text-base">
            <EyeIcon aria-hidden className="size-4 shrink-0" />
            {t("play.summary.solutionsViewed", { count: counts.revealed })}
          </p>
        )}
      </section>

      <div className="mx-auto max-w-[860px] px-4 md:px-6">
        <section
          aria-label={t("play.summary.figures")}
          className="relative -mt-6 grid overflow-hidden rounded-[10px] bg-card text-card-foreground shadow-[0_18px_50px_color-mix(in_oklab,var(--foreground)_18%,transparent)] sm:grid-cols-3"
        >
          <Figure icon={TargetIcon} label={t("play.summary.score")}>
            <strong className="text-[1.9rem] leading-tight tabular-nums">
              {formatNumber(state.score)}
            </strong>
            <span className="text-sm text-muted-foreground">
              {t("play.summary.scoreMax", { max: formatNumber(state.maxScore) })}
            </span>
          </Figure>
          <Figure icon={ZapIcon} label={t("play.summary.xp")}>
            <strong className="text-[1.9rem] leading-tight tabular-nums">
              {state.saved
                ? t("play.summary.xpGained", { xp: formatNumber(gained) })
                : t("play.summary.xpNotSaved")}
            </strong>
            <XpDetail state={state} />
          </Figure>
          <Figure icon={CircleCheckIcon} label={t("play.summary.slots")}>
            <strong className="text-[1.9rem] leading-tight tabular-nums">
              {formatNumber(review.length)}
            </strong>
            <ul className="flex flex-wrap justify-center gap-x-3 text-sm">
              <li className="inline-flex items-center gap-1 text-success">
                <CircleCheckIcon aria-hidden className="size-4" />
                {t("play.summary.counts.optimal", { count: counts.optimal })}
              </li>
              {counts.accepted > 0 && (
                <li className="inline-flex items-center gap-1 text-warning">
                  <MinusIcon aria-hidden className="size-4" />
                  {t("play.summary.counts.accepted", { count: counts.accepted })}
                </li>
              )}
              {counts.revealed > 0 && (
                <li className="inline-flex items-center gap-1 text-blueprint">
                  <EyeIcon aria-hidden className="size-4" />
                  {t("play.summary.counts.revealed", { count: counts.revealed })}
                </li>
              )}
            </ul>
          </Figure>
        </section>

        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>

        {!state.saved && <NotSavedNotice />}

        {achievements.length > 0 && (
          <section aria-labelledby="summary-achievements" className="mt-10">
            <h2 id="summary-achievements" className="sr-only">
              {t("play.summary.achievements")}
            </h2>
            <ul className="grid gap-3">
              {achievements.map((event) => (
                <Achievement
                  key={event.type === "rankUp" ? event.to.id : `level-${event.level}`}
                  event={event}
                  areas={bundle.index.areas}
                  reducedMotion={reducedMotion}
                />
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="summary-review" className="mt-12">
          <header className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between md:gap-4">
            <div>
              <p className="section-kicker">{t("play.summary.reviewKicker")}</p>
              <h2 id="summary-review" className="mt-1 text-[1.6rem]">
                {t("play.summary.reviewTitle")}
              </h2>
            </div>
            <p className="text-muted-foreground">{t("play.summary.reviewLead")}</p>
          </header>
          <ol className="grid gap-[0.65rem]">
            {review.map((item) => (
              <ReviewItem key={item.slotId} item={item} services={services} />
            ))}
          </ol>
          {scenario.references.length > 0 && (
            <section
              aria-labelledby="summary-readings"
              className="mt-6 rounded-[7px] border bg-card p-4"
            >
              <h3 id="summary-readings" className="font-bold">
                {t("play.summary.readings")}
              </h3>
              <ul className="mt-2 grid gap-1">
                {scenario.references.map((reference) => (
                  <li key={reference.url}>
                    <ExternalLink href={reference.url}>{reference.title}</ExternalLink>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </section>

        <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
          <Button
            asChild
            variant="ghost"
            className="h-auto min-h-9 justify-start px-2 py-2 whitespace-normal text-primary"
          >
            <a href={reportUrl} target="_blank" rel="noopener noreferrer">
              <FlagIcon aria-hidden />
              {t("play.summary.report")}
              <ExternalLinkIcon aria-hidden />
              <span className="sr-only">{t("play.summary.newTab")}</span>
            </a>
          </Button>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button asChild variant="outline" size="lg" className="px-5">
              <Link to={`/escenarios/${scenario.id}/imprimir`}>
                <PrinterIcon aria-hidden />
                {t("play.summary.print")}
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="px-5">
              <Link to={`/escenarios/${scenario.id}`}>
                <RotateCcwIcon aria-hidden />
                {t("play.summary.replay")}
              </Link>
            </Button>
            <Button asChild size="lg" className="px-5">
              <Link to="/escenarios">
                {t("play.summary.browse")}
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Figure({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[115px] flex-col items-center justify-center gap-1 border-b px-4 py-5 text-center last:border-0 sm:border-r sm:border-b-0">
      <Icon aria-hidden className="size-5 text-primary" />
      <p className="text-sm font-extrabold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

/** How the XP was computed and, when the scenario was already completed, what it added. */
function XpDetail({ state }: { state: SummaryState }) {
  const { t } = useTranslation();
  const attempt = t("play.summary.xpAttempt", {
    score: formatNumber(state.score),
    multiplier: formatNumber(state.multiplier),
    level: state.level,
    xp: formatNumber(state.xp),
  });
  const comparison = state.comparison;
  const note =
    comparison === null || comparison.kind === "first"
      ? null
      : comparison.kind === "improved"
        ? t("play.summary.xpImproved", { previous: formatNumber(comparison.previousXp) })
        : comparison.kind === "equal"
          ? t("play.summary.xpEqual")
          : t("play.summary.xpLower");
  return (
    <>
      <span className="text-sm text-muted-foreground">{attempt}</span>
      {note !== null && <span className="text-sm font-semibold">{note}</span>}
    </>
  );
}

function NotSavedNotice() {
  const { t } = useTranslation();
  const incompatible = useProgressStore((s) => s.incompatible);
  return (
    <p className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 sm:flex-row sm:items-center sm:justify-between">
      <span>{t(incompatible ? "play.summary.notSavedIncompatible" : "play.summary.notSaved")}</span>
      {!incompatible && (
        <Button asChild variant="outline" className="h-auto min-h-9 whitespace-normal">
          <Link to="/bienvenida">{t("play.summary.setUp")}</Link>
        </Button>
      )}
    </p>
  );
}

type AchievementEvent = Exclude<ProgressEvent, { type: "xpGained" }>;

const achievementText = (
  t: ReturnType<typeof useTranslation>["t"],
  event: AchievementEvent,
  areas: ContentBundle["index"]["areas"],
) =>
  event.type === "rankUp"
    ? t("play.summary.rankUpText", { rank: event.to.name })
    : t("play.summary.levelUnlockedText", {
        level: event.level,
        areas: areaList(event.areas, areas),
      });

/** Ten pieces that fall once from the trophy (.motion-confetti). Decoration only. */
function Confetti() {
  return (
    <div
      aria-hidden="true"
      data-slot="confetti"
      className="motion-confetti pointer-events-none absolute inset-0"
    >
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} style={{ "--i": i } as CSSProperties} />
      ))}
    </div>
  );
}

function Achievement({
  event,
  areas,
  reducedMotion,
}: {
  event: AchievementEvent;
  areas: ContentBundle["index"]["areas"];
  reducedMotion: boolean;
}) {
  const { t } = useTranslation();
  const Icon = event.type === "rankUp" ? AwardIcon : LockOpenIcon;
  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-lg border border-warning bg-warning-soft p-[1.2rem]">
      <span
        aria-hidden="true"
        className={cn(
          "grid size-[55px] place-items-center rounded-lg bg-warning text-primary-foreground",
          motionClass("celebrateLate", reducedMotion),
        )}
      >
        <Icon className="size-6" />
      </span>
      <div>
        <p className="section-kicker">
          {t(event.type === "rankUp" ? "play.summary.rankUp" : "play.summary.levelUnlocked")}
        </p>
        <p className="mt-1 text-lg">{achievementText(t, event, areas)}</p>
      </div>
    </li>
  );
}

/** Grade label of a reviewed slot: an accepted orange reads as "Aceptable". */
const reviewGrade = (item: SlotReview): SlotGrade =>
  item.status === "accepted" ? "acceptable" : item.status;

function ReviewItem({
  item,
  services,
}: {
  item: SlotReview;
  services: ReadonlyMap<string, Service>;
}) {
  const { t } = useTranslation();
  const chosen = item.chosen === null ? undefined : services.get(item.chosen);
  const chosenName = chosen?.name ?? item.chosen ?? t("play.summary.empty");
  const choseOptimal = item.optimal.some((answer) => answer.serviceId === item.chosen);
  const name = (id: string) => services.get(id)?.name ?? id;
  // A viewed solution shows the first optimal answer; the others are named after it.
  const alsoOptimal =
    item.status === "revealed"
      ? item.optimal.filter((a) => a.serviceId !== item.chosen).map((a) => name(a.serviceId))
      : [];
  const meta = [
    t("play.summary.hints", { count: item.hintsUsed }),
    ...(item.errors > 0 ? [t("play.summary.errors", { count: item.errors })] : []),
    t("play.summary.points", { points: formatNumber(item.points) }),
  ];

  return (
    <li className="grid grid-cols-[auto_auto_1fr] items-start gap-x-3 gap-y-3 rounded-[7px] border bg-card p-4 sm:grid-cols-[auto_auto_1fr_auto] sm:gap-x-4">
      <span className="grid size-[30px] place-items-center rounded-md bg-blueprint-soft font-extrabold text-primary">
        <span className="sr-only">{t("play.summary.slot", { number: item.number })}</span>
        <span aria-hidden="true">{item.number}</span>
      </span>
      {chosen === undefined ? (
        <span aria-hidden="true" className="size-9 rounded-md bg-muted" />
      ) : (
        <ServiceIcon
          {...entryIcon(chosen, serviceIconSrc)}
          name={chosen.name}
          category={chosen.category}
          decorative
          className="size-9"
        />
      )}
      <div className="col-span-3 row-start-2 min-w-0 sm:col-span-1 sm:col-start-3 sm:row-start-1">
        <p className="text-sm text-muted-foreground">{item.role}</p>
        <h3 className="mt-1 text-base font-semibold">
          <span className="text-sm font-normal text-muted-foreground">
            {t(
              item.status === "revealed"
                ? "play.summary.solutionViewed"
                : "play.summary.yourChoice",
            )}
            :{" "}
          </span>
          {chosenName}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{meta.join(" · ")}</p>
        {alsoOptimal.length > 0 && (
          <p className="mt-2 text-sm font-bold">
            {t("play.summary.alsoOptimal", {
              count: alsoOptimal.length,
              services: new Intl.ListFormat("es", { type: "conjunction" }).format(alsoOptimal),
            })}
          </p>
        )}
        {!choseOptimal && (
          <p className="mt-3 flex items-center gap-1 text-sm font-bold">
            <CircleCheckIcon aria-hidden className="size-4 text-success" />
            {t(
              item.optimal.length > 1
                ? "play.summary.optimalAnswers"
                : "play.summary.optimalAnswer",
            )}
            :{" "}
            {new Intl.ListFormat("es", { type: "disjunction" }).format(
              item.optimal.map((a) => name(a.serviceId)),
            )}
          </p>
        )}
        <ul className="mt-2 grid gap-3">
          {item.optimal.map((answer) => (
            <li key={answer.serviceId}>
              <p className="text-muted-foreground">
                {item.optimal.length > 1 && (
                  <strong className="text-foreground">{name(answer.serviceId)}: </strong>
                )}
                <InlineMarkdown text={answer.rationale} />
              </p>
              {answer.references.length > 0 && (
                <ul aria-label={t("play.summary.docs")} className="mt-1 grid gap-1">
                  {answer.references.map((url) => (
                    <li key={url}>
                      <ExternalLink href={url}>{referenceLabel(url)}</ExternalLink>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
      <span className="col-start-3 row-start-1 self-start justify-self-end rounded-md border px-2 py-1 sm:col-start-4">
        <GradeBadge grade={reviewGrade(item)} className="text-sm" />
        {item.status === "accepted" && (
          <span className="sr-only">, {t("play.summary.accepted")}</span>
        )}
      </span>
    </li>
  );
}

/** "docs.aws.amazon.com/lambda/latest/dg/welcome.html": readable, and says where it goes. */
const referenceLabel = (url: string) => {
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname === "/" ? "" : pathname}`;
};

/** A link to another site: new tab, without opener, and it says so (icon and hidden text). */
function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-start gap-1 text-sm font-semibold break-all text-primary underline-offset-4 hover:underline"
    >
      <span>{children}</span>
      <ExternalLinkIcon aria-hidden className="mt-[0.2rem] size-3.5 shrink-0" />
      <span className="sr-only">{t("play.summary.newTab")}</span>
    </a>
  );
}
