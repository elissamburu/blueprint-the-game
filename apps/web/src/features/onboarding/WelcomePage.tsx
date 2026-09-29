// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Onboarding (RF-ONB-01, RF-ONB-02; docs/design/pantallas/00): areas of interest and experience.
// "Ver mi ruta" creates the progress with game-engine, saves it and opens the scenarios. The areas
// come from content/areas.yaml and the experiences from game-rules.yaml, with their texts in i18n.
// There is no "1 de 2": the second step (the tutorial, RF-ONB-04) does not exist yet.
// Lovable: Onboarding, .onboarding-shell, .onboarding-grid, .onboarding-intro, .mini-blueprint,
// .setup-panel, .chip-grid, .experience-list (blueprint-app.tsx, styles.css).
import { createProgress } from "@blueprint/game-engine";
import type { Experience } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ArrowRightIcon,
  BoxIcon,
  CloudIcon,
  Globe2Icon,
  ShieldCheckIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate } from "react-router";
import { useStandaloneLayout } from "../../app/immersive";
import { usePageTitle } from "../../app/page";
import type { ContentBundle } from "../../content/load-bundle";
import { Loading, RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";
import { AreaToggles, ExperienceRadios } from "./PreferenceFields";

export default function WelcomePage() {
  const { t } = useTranslation();
  usePageTitle(t("welcome.title"));
  useStandaloneLayout();
  const status = useProgressStore((s) => s.status);
  const hasProgress = useProgressStore((s) => s.progress !== null);
  const incompatible = useProgressStore((s) => s.incompatible);

  // Onboarding is for a player without progress; changing the areas is in the profile.
  if (status !== "ready") return <Loading label={t("app.loading")} />;
  if (hasProgress) return <Navigate to="/escenarios" replace />;

  return (
    <div className="min-h-screen bg-background bg-[linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] bg-size-[42px_42px] px-4 pt-6 pb-10 md:px-[5vw] md:pt-[34px] md:pb-12">
      <p className="mb-[46px] inline-flex items-center gap-[0.65rem] text-[1.05rem] font-extrabold">
        <span className="inline-grid size-[34px] place-items-center rounded-lg bg-primary text-primary-foreground shadow-[0_5px_16px_color-mix(in_oklab,var(--primary)_24%,transparent)]">
          <BoxIcon aria-hidden className="size-[18px]" />
        </span>
        {t("app.name")}
      </p>
      <div className="mx-auto grid max-w-[1180px] items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-[8vw]">
        <Intro />
        {incompatible ? (
          <IncompatibleNotice />
        ) : (
          <RequireContent>{(bundle) => <SetupPanel bundle={bundle} />}</RequireContent>
        )}
      </div>
    </div>
  );
}

function Intro() {
  const { t } = useTranslation();
  return (
    <section className="md:pb-16">
      <Badge className="gap-[0.4rem] border-0 bg-success-soft text-sm text-success shadow-none hover:bg-success-soft [&>svg]:size-[14px]">
        <SparklesIcon aria-hidden />
        {t("welcome.eyebrow")}
      </Badge>
      <h1 className="mt-6 max-w-[640px] text-[2.65rem] leading-[1.02] md:text-[clamp(2.6rem,5vw,4.6rem)]">
        {t("welcome.headline")}
      </h1>
      <p className="mt-[1.4rem] max-w-[520px] text-base leading-[1.75] text-muted-foreground md:text-[1.1rem]">
        {t("welcome.lead")}
      </p>
      <div aria-hidden="true" className="mt-12 hidden items-center md:flex">
        <MiniNode icon={Globe2Icon} />
        <span className="w-[62px] border-t-2 border-dashed" />
        <MiniNode icon={CloudIcon} active />
        <span className="w-[62px] border-t-2 border-dashed" />
        <MiniNode icon={ShieldCheckIcon} />
      </div>
    </section>
  );
}

function MiniNode({ icon: Icon, active = false }: { icon: LucideIcon; active?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-[54px] place-items-center rounded-lg border bg-card text-muted-foreground shadow-[0_8px_25px_color-mix(in_oklab,var(--foreground)_8%,transparent)]",
        active && "border-primary text-primary",
      )}
    >
      <Icon className="size-6" />
    </span>
  );
}

const panelClass =
  "rounded-xl border bg-card p-5 shadow-[0_22px_65px_color-mix(in_oklab,var(--foreground)_9%,transparent)] md:p-[clamp(1.5rem,3vw,2.7rem)]";

function SetupPanel({ bundle }: { bundle: ContentBundle }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const replace = useProgressStore((s) => s.replace);
  const id = useId();
  const [interests, setInterests] = useState<readonly string[]>([]);
  const [experience, setExperience] = useState<Experience | null>(null);
  const [saving, setSaving] = useState(false);
  const ready = interests.length > 0 && experience !== null;

  const submit = async (event: MouseEvent<HTMLButtonElement>) => {
    // aria-disabled keeps the button focusable, so its reason is read; it does nothing.
    if (!ready || saving) {
      event.preventDefault();
      return;
    }
    setSaving(true);
    const progress = createProgress(
      { experience, interests },
      bundle.index.scenarios,
      bundle.rules,
    );
    await replace(progress);
    void navigate("/escenarios");
  };

  return (
    <section aria-labelledby={`${id}-title`} className={panelClass}>
      <p className="section-kicker">{t("welcome.kicker")}</p>
      <h2 id={`${id}-title`} className="mt-[0.65rem] text-[1.8rem]">
        {t("welcome.title")}
      </h2>
      <p className="mt-[0.6rem] leading-[1.6] text-muted-foreground">{t("welcome.description")}</p>
      <AreaToggles
        areas={bundle.index.areas}
        value={interests}
        onChange={setInterests}
        className="mt-[1.8rem]"
      />
      <ExperienceRadios
        rules={bundle.rules}
        value={experience}
        onChange={setExperience}
        className="mt-[1.8rem]"
      />
      <Button
        size="lg"
        className="mt-[1.8rem] w-full aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        aria-disabled={!ready || saving}
        aria-describedby={ready ? undefined : `${id}-missing`}
        onClick={(event) => void submit(event)}
      >
        {t("welcome.submit")} <ArrowRightIcon aria-hidden />
      </Button>
      {!ready && (
        <p id={`${id}-missing`} className="mt-3 text-center text-sm text-muted-foreground">
          {t("welcome.missing")}
        </p>
      )}
    </section>
  );
}

function IncompatibleNotice() {
  const { t } = useTranslation();
  return (
    <section className={panelClass}>
      <p className="leading-[1.6]">{t("welcome.incompatible")}</p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/escenarios">
          {t("welcome.browse")} <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </section>
  );
}
