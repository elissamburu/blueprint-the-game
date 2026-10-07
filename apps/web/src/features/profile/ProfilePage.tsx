// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /perfil (RF-GAM-01, RF-ONB-03; docs/design, captura 04 and "fuera del alcance de F1"): rank,
// XP and the way to the next rank (thresholds of game-rules.yaml), completed scenarios with their
// best result, open levels by area, the onboarding questions to change areas and experience, and
// "Reiniciar progreso". Rank progress, unlocks and preference changes come from game-engine.
// No "Nv. N" (the player has a rank), badges, mastery, album, streak nor daily goal (F4 or not
// in the requirements). While the stored progress is incompatible nothing can be saved or reset.
// Lovable: Profile, .profile-hero, .rank-band, .rank-emblem, .rank-copy, .profile-grid,
// .profile-section (blueprint-app.tsx, styles.css).
import {
  rankProgress,
  unlockedLevelsByArea,
  updatePreferences,
  type PlayerProgress,
} from "@blueprint/game-engine";
import type { Experience } from "@blueprint/scenario-schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@blueprint/ui/components/alert-dialog";
import { Button, buttonVariants } from "@blueprint/ui/components/button";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { formatNumber } from "@blueprint/ui/lib/format";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ArrowRightIcon,
  AwardIcon,
  CircleCheckIcon,
  RotateCcwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import type { ContentBundle } from "../../content/load-bundle";
import { Loading, RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";
import { usePlayerProgress } from "../../progress/use-player-progress";
import { AreaToggles, ExperienceRadios } from "../onboarding/PreferenceFields";
import { progressEventText } from "../play/finish";

export default function ProfilePage() {
  const { t } = useTranslation();
  usePageTitle(t("profile.title"));
  const status = useProgressStore((s) => s.status);
  const hasProgress = useProgressStore((s) => s.progress !== null);
  const incompatible = useProgressStore((s) => s.incompatible);
  if (status !== "ready") return <Loading label={t("app.loading")} />;
  // The profile is of a player: before the onboarding there is none.
  if (!hasProgress && !incompatible) return <Navigate to="/bienvenida" replace />;
  return <RequireContent>{(bundle) => <Profile bundle={bundle} />}</RequireContent>;
}

function Profile({ bundle }: { bundle: ContentBundle }) {
  const { t } = useTranslation();
  const progress = usePlayerProgress(bundle);
  const completed = progress === null ? 0 : Object.keys(progress.best).length;
  return (
    <PageShell>
      <PageHeading
        kicker={t("profile.kicker")}
        title={t("profile.title")}
        {...(progress === null
          ? {}
          : {
              description: t("profile.completedCount", {
                count: completed,
                formatted: formatNumber(completed),
              }),
            })}
      />
      {progress === null ? (
        <IncompatibleNotice />
      ) : (
        <>
          <RankBand xp={progress.xp} bundle={bundle} />
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <CompletedScenarios progress={progress} bundle={bundle} />
            <UnlockedLevels progress={progress} bundle={bundle} />
          </div>
        </>
      )}
      <Preferences progress={progress} bundle={bundle} />
      <ResetProgress disabled={progress === null} />
    </PageShell>
  );
}

const sectionClass = "rounded-lg border bg-card p-5 md:p-[1.4rem]";

function Section({
  kicker,
  title,
  aside,
  className,
  children,
}: {
  kicker: string;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn(sectionClass, className)}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h2 id={id} className="mt-1 text-[1.3rem]">
            {title}
          </h2>
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

function IncompatibleNotice() {
  const { t } = useTranslation();
  return (
    <p
      id="profile-incompatible"
      className="flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4"
    >
      <TriangleAlertIcon aria-hidden className="mt-[0.2rem] size-5 shrink-0 text-warning" />
      {t("profile.incompatible")}
    </p>
  );
}

function RankBand({ xp, bundle }: { xp: number; bundle: ContentBundle }) {
  const { t } = useTranslation();
  const { rank, next, percent } = rankProgress(xp, bundle.rules);
  const labelId = useId();
  return (
    <section
      aria-labelledby={labelId}
      className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-[10px] bg-blueprint p-5 text-primary-foreground md:gap-[1.2rem] md:px-8 md:py-6"
    >
      <span
        aria-hidden="true"
        className="grid size-12 place-items-center rounded-[10px] bg-primary-foreground/15 md:size-16"
      >
        <AwardIcon className="size-6 md:size-7" />
      </span>
      <div className="min-w-0">
        <h2 id={labelId} className="text-sm font-extrabold tracking-[0.1em] uppercase opacity-90">
          {t("profile.rank")}
        </h2>
        <p className="mt-1 text-2xl">{rank.name}</p>
      </div>
      <div className="col-span-2 md:col-start-2">
        {next === null ? (
          <p className="opacity-90">{t("profile.top", { xp: formatNumber(xp) })}</p>
        ) : (
          <>
            <p id={`${labelId}-next`} className="opacity-90">
              {t("profile.toNext", {
                xp: formatNumber(xp),
                next: formatNumber(next.minXp),
                rank: next.name,
              })}
            </p>
            <div
              role="progressbar"
              aria-label={t("profile.progressLabel", { rank: next.name })}
              aria-valuemin={rank.minXp}
              aria-valuemax={next.minXp}
              aria-valuenow={xp}
              aria-valuetext={t("profile.progressValue", {
                xp: formatNumber(xp),
                next: formatNumber(next.minXp),
              })}
              className="mt-3 h-2 w-full max-w-[560px] overflow-hidden rounded-full bg-primary-foreground/20"
            >
              <div className="h-full bg-warning" style={{ width: `${percent}%` }} />
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function CompletedScenarios({
  progress,
  bundle,
}: {
  progress: PlayerProgress;
  bundle: ContentBundle;
}) {
  const { t } = useTranslation();
  const titles = new Map(bundle.index.scenarios.map((s) => [s.id, s.title]));
  const entries = Object.entries(progress.best).sort(
    ([a, x], [b, y]) => x.level - y.level || a.localeCompare(b),
  );
  return (
    <Section kicker={t("profile.completedKicker")} title={t("profile.completed")}>
      {entries.length === 0 ? (
        <div className="mt-4">
          <p className="text-muted-foreground">{t("profile.noneCompleted")}</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/escenarios">
              {t("play.summary.browse")} <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-4 grid gap-[0.65rem]">
          {entries.map(([id, best]) => (
            <li
              key={id}
              className="grid gap-x-3 gap-y-1 rounded-md border p-3 sm:grid-cols-[1fr_auto] sm:items-center"
            >
              <div className="min-w-0">
                <p className="font-semibold break-words">{titles.get(id) ?? id}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("profile.best", {
                    score: formatNumber(best.score),
                    max: formatNumber(best.maxScore),
                  })}{" "}
                  · {t("profile.bestXp", { xp: formatNumber(best.xp) })}
                </p>
              </div>
              <LevelBadge level={best.level} className="justify-self-start" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function UnlockedLevels({ progress, bundle }: { progress: PlayerProgress; bundle: ContentBundle }) {
  const { t } = useTranslation();
  const areas = bundle.index.areas;
  const byArea = unlockedLevelsByArea(
    progress.unlocked,
    areas.map((a) => a.id),
  );
  return (
    <Section kicker={t("profile.unlockedKicker")} title={t("profile.unlocked")}>
      <p className="mt-2 text-muted-foreground">{t("profile.unlockedLead")}</p>
      <dl className="mt-4 grid gap-3">
        {byArea.map(({ area, levels }) => (
          <div key={area} className="flex flex-wrap items-center justify-between gap-2">
            <dt className="font-semibold">{areas.find((a) => a.id === area)?.name ?? area}</dt>
            <dd>
              <ul className="flex flex-wrap gap-1">
                {levels.map((level) => (
                  <li key={level}>
                    <LevelBadge level={level} />
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Preferences({
  progress,
  bundle,
}: {
  progress: PlayerProgress | null;
  bundle: ContentBundle;
}) {
  const { t } = useTranslation();
  const replace = useProgressStore((s) => s.replace);
  const id = useId();
  const [interests, setInterests] = useState<readonly string[]>(progress?.interests ?? []);
  const [experience, setExperience] = useState<Experience | null>(progress?.experience ?? null);
  const [saving, setSaving] = useState(false);
  /** What the last save did; it stays until the player edits again or leaves the page. */
  const [status, setStatus] = useState<string | null>(null);
  const editInterests = (next: readonly string[]) => {
    setStatus(null);
    setInterests(next);
  };
  const editExperience = (next: Experience) => {
    setStatus(null);
    setExperience(next);
  };

  const changed = useMemo(
    () =>
      progress !== null &&
      (experience !== progress.experience ||
        interests.length !== progress.interests.length ||
        interests.some((area) => !progress.interests.includes(area))),
    [progress, experience, interests],
  );
  const reason =
    progress === null
      ? null
      : interests.length === 0
        ? t("profile.needArea")
        : !changed
          ? t("profile.noChanges")
          : null;
  const blocked = progress === null || reason !== null || saving || experience === null;

  const save = async (event: MouseEvent<HTMLButtonElement>) => {
    // aria-disabled keeps the button focusable, so its reason is read; it does nothing.
    if (blocked || progress === null || experience === null) {
      event.preventDefault();
      return;
    }
    setSaving(true);
    const update = updatePreferences(
      progress,
      { experience, interests },
      bundle.index.scenarios,
      bundle.rules,
    );
    await replace(update.progress);
    setSaving(false);
    setStatus(
      update.events.length === 0
        ? t("profile.saved")
        : update.events.map((e) => progressEventText(t, e, bundle.index.areas)).join(" "),
    );
  };

  // After a save, its status explains why the button is off ("no changes" would repeat it).
  const describedBy =
    progress === null
      ? "profile-incompatible"
      : status !== null
        ? `${id}-status`
        : reason === null
          ? undefined
          : `${id}-reason`;

  return (
    <Section
      kicker={t("profile.preferencesKicker")}
      title={t("profile.preferences")}
      className="mt-4"
    >
      <AreaToggles
        areas={bundle.index.areas}
        value={interests}
        onChange={editInterests}
        className="mt-5"
      />
      <ExperienceRadios
        rules={bundle.rules}
        scenarios={bundle.index.scenarios}
        value={experience}
        onChange={editExperience}
        description={t("profile.experienceHelp")}
        className="mt-6"
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button
          aria-disabled={blocked}
          aria-describedby={describedBy}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={(event) => void save(event)}
        >
          {saving ? t("profile.saving") : t("profile.save")}
        </Button>
        {reason !== null && status === null && (
          <p id={`${id}-reason`} className="text-sm text-muted-foreground">
            {reason}
          </p>
        )}
        {/* Always rendered, so screen readers announce the text when it arrives. */}
        <p
          id={`${id}-status`}
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-sm font-semibold text-success"
        >
          {status !== null && (
            <>
              <CircleCheckIcon aria-hidden className="size-4 shrink-0" />
              {status}
            </>
          )}
        </p>
      </div>
    </Section>
  );
}

function ResetProgress({ disabled }: { disabled: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const reset = useProgressStore((s) => s.reset);
  const onConfirm = async () => {
    await reset();
    void navigate("/bienvenida");
  };
  const trigger = (
    <Button
      variant="outline"
      className="border-destructive text-destructive hover:bg-danger-soft hover:text-destructive aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      aria-disabled={disabled}
      aria-describedby={disabled ? "profile-incompatible" : undefined}
    >
      <RotateCcwIcon aria-hidden />
      {t("profile.reset")}
    </Button>
  );
  return (
    <Section kicker={t("profile.resetKicker")} title={t("profile.reset")} className="mt-4">
      <p className="mt-2 text-muted-foreground">{t("profile.resetLead")}</p>
      <div className="mt-4">
        {disabled ? (
          trigger
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.resetConfirmTitle")}</AlertDialogTitle>
                <AlertDialogDescription>{t("profile.resetConfirmText")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("profile.resetCancel")}</AlertDialogCancel>
                <AlertDialogAction
                  className={buttonVariants({ variant: "destructive" })}
                  onClick={() => void onConfirm()}
                >
                  {t("profile.resetConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </Section>
  );
}
