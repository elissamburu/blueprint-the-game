// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Brief shown when a scenario opens (RF-PLAY-01, layout v2): level, areas, estimated time, the
// context, restrictions and goals, and a still preview of the diagram with empty slots. A modal
// dialog: the focus stays inside and "Empezar a diseñar" (or Esc) opens the board. The footer links
// to the printable version (RF-PLAY-16). When the game in progress was resumed, or dropped because
// the scenario changed its version, the brief says so first (RF-PLAY-18).
// Lovable: ScenarioBrief, .scenario-brief-overlay, .scenario-brief-card, .brief-content,
// .brief-objectives, .mini-diagram (src/components/blueprint-app.tsx, styles.css), captura 12.
import { Diagram, type ServiceLookup } from "@blueprint/diagram";
import type { Scenario } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@blueprint/ui/components/dialog";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import {
  ArrowRightIcon,
  ClockIcon,
  HistoryIcon,
  InfoIcon,
  LightbulbIcon,
  PrinterIcon,
} from "lucide-react";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CaseContext, CaseObjectives } from "./CaseContent";
import { ExitButton } from "./ExitButton";
import type { GameHost } from "./host";
import { Kicker } from "./Kicker";
import { StatusBadge } from "./StatusBadge";

/** What happened to the saved game in progress, when the player must be told (RF-PLAY-18). */
export type BriefNotice = "resumed" | "outdated";

export interface ScenarioBriefProps {
  scenario: Scenario;
  areaNames: readonly string[];
  services: ServiceLookup;
  exit: GameHost["exit"];
  /** Route of the printable version; without it the brief does not offer it. */
  printHref?: string | undefined;
  notice?: BriefNotice | null;
  open: boolean;
  /** "Empezar a diseñar", Esc or a click outside. */
  onStart: () => void;
  /** Where the focus goes once the brief is closed (it has no trigger to return to). */
  onClosed: () => void;
}

export function ScenarioBrief({
  scenario,
  areaNames,
  services,
  exit,
  printHref,
  notice = null,
  open,
  onStart,
  onClosed,
}: ScenarioBriefProps) {
  const { t } = useTranslation("play");
  const previewId = useId();
  const startRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStart()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-foreground/45 backdrop-blur-[5px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          startRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
        className="flex max-h-[calc(100dvh-2rem)] w-[min(63.75rem,calc(100vw-2rem))] max-w-none flex-col gap-0 overflow-y-auto rounded-xl bg-card p-0 shadow-[0_30px_80px_color-mix(in_oklab,var(--foreground)_24%,transparent)] sm:rounded-xl"
      >
        <header className="flex min-h-[3.875rem] flex-wrap items-center gap-[0.65rem] border-b px-5 py-3">
          <ExitButton exit={exit} />
          <LevelBadge level={scenario.level} variant="solid" className="text-sm" />
          <StatusBadge status={scenario.status} className="text-sm" />
          <ul aria-label={t("areas")} className="flex flex-wrap gap-2">
            {areaNames.map((name) => (
              <li key={name}>
                <Badge variant="secondary" className="text-sm">
                  {name}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="ml-auto flex items-center gap-[0.4rem] text-sm font-bold text-muted-foreground">
            <ClockIcon aria-hidden className="size-4" />
            <span className="sr-only">{t("brief.minutesLabel")}: </span>
            {t("brief.minutes", { count: scenario.estimatedMinutes })}
          </p>
        </header>
        <div className="grid gap-10 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="min-w-0">
            {notice !== null && (
              <p
                role="status"
                className="mb-6 flex items-start gap-2 rounded-lg border bg-muted p-3 text-base font-semibold"
              >
                {notice === "resumed" ? (
                  <HistoryIcon aria-hidden className="mt-[0.2rem] size-5 shrink-0" />
                ) : (
                  <InfoIcon aria-hidden className="mt-[0.2rem] size-5 shrink-0" />
                )}
                {t(`brief.${notice}`)}
              </p>
            )}
            <Kicker>{t("brief.kicker")}</Kicker>
            <DialogTitle className="mt-2 max-w-[40.625rem] text-[2rem] leading-[1.16] font-normal tracking-normal">
              {scenario.title}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="mt-4 text-base text-muted-foreground">
                <CaseContext scenario={scenario} />
              </div>
            </DialogDescription>
            <CaseObjectives scenario={scenario} className="grid gap-x-4 sm:grid-cols-2" />
          </section>
          <section aria-labelledby={previewId} className="min-w-0">
            <h3 id={previewId}>
              <Kicker>{t("brief.preview")}</Kicker>
            </h3>
            <Diagram
              preview
              diagram={scenario.diagram}
              services={services}
              label={t("brief.previewLabel")}
              className="mt-3 h-[21.25rem] rounded-lg border"
            />
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t bg-background px-6 py-4 md:px-10">
          <p className="flex items-center gap-[0.45rem] text-sm text-muted-foreground">
            <LightbulbIcon aria-hidden className="size-4 shrink-0" />
            {t("brief.tip")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {printHref !== undefined && (
              <Button asChild variant="ghost" className="text-primary">
                <Link to={printHref}>
                  <PrinterIcon aria-hidden />
                  {t("brief.print")}
                </Link>
              </Button>
            )}
            <DialogClose asChild>
              <Button ref={startRef} size="lg" className="text-base">
                {t("brief.start")}
                <ArrowRightIcon aria-hidden />
              </Button>
            </DialogClose>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
