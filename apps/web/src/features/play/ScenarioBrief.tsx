// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Brief shown when a scenario opens (RF-PLAY-01, layout v2): level, areas, estimated time, the
// context, restrictions and goals, and a still preview of the diagram with empty slots. A modal
// dialog: the focus stays inside and "Empezar a diseñar" (or Esc) opens the board.
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
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, LightbulbIcon } from "lucide-react";
import { useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { StatusBadge } from "../catalog-browse/StatusBadge";
import { CaseContext, CaseObjectives } from "./CaseContent";
import { Kicker } from "./Kicker";

export interface ScenarioBriefProps {
  scenario: Scenario;
  areaNames: readonly string[];
  services: ServiceLookup;
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
  open,
  onStart,
  onClosed,
}: ScenarioBriefProps) {
  const { t } = useTranslation();
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
          <Button asChild variant="ghost" size="icon">
            <Link to="/escenarios" aria-label={t("play.back")}>
              <ArrowLeftIcon aria-hidden />
            </Link>
          </Button>
          <LevelBadge level={scenario.level} variant="solid" className="text-sm" />
          <StatusBadge status={scenario.status} className="text-sm" />
          <ul aria-label={t("scenarios.areas")} className="flex flex-wrap gap-2">
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
            <span className="sr-only">{t("play.brief.minutesLabel")}: </span>
            {t("play.brief.minutes", { count: scenario.estimatedMinutes })}
          </p>
        </header>
        <div className="grid gap-10 px-6 py-8 md:px-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="min-w-0">
            <Kicker>{t("play.brief.kicker")}</Kicker>
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
              <Kicker>{t("play.brief.preview")}</Kicker>
            </h3>
            <Diagram
              preview
              diagram={scenario.diagram}
              services={services}
              label={t("play.brief.previewLabel")}
              className="mt-3 h-[21.25rem] rounded-lg border"
            />
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t bg-background px-6 py-4 md:px-10">
          <p className="flex items-center gap-[0.45rem] text-sm text-muted-foreground">
            <LightbulbIcon aria-hidden className="size-4 shrink-0" />
            {t("play.brief.tip")}
          </p>
          <DialogClose asChild>
            <Button ref={startRef} size="lg" className="text-base">
              {t("play.brief.start")}
              <ArrowRightIcon aria-hidden />
            </Button>
          </DialogClose>
        </footer>
      </DialogContent>
    </Dialog>
  );
}
