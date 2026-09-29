// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game screen (RF-PLAY-01..08, RF-PLAY-13), in its own chunk with React Flow and @dnd-kit
// (ADR-0004, RNF-03). Fixed height, no page scroll: top bar, then the case, the board with the
// feedback anchored at its foot, and the palette. Every gesture goes through the adapters of
// src/interaction (ADR-0008) and every grade, score, completion and unlock comes from game-engine.
// Lovable: .game-shell, .game-layout, .game-topbar (src/styles.css).
import { Diagram } from "@blueprint/diagram";
import {
  buildPalette,
  canApply,
  commands,
  isSlotResolved,
  revealedHints,
  scenarioResult,
  slotNodes,
} from "@blueprint/game-engine";
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { Progress } from "@blueprint/ui/components/progress";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { toast } from "@blueprint/ui/components/sonner";
import { cn } from "@blueprint/ui/lib/utils";
import { ArrowLeftIcon, FlagIcon, StarIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import type { ContentBundle } from "../../content/load-bundle";
import { ServiceDndContext } from "../../interaction/drag";
import { useProgressStore } from "../../progress/progress-store";
import { serviceIconSrc } from "../../service-icons";
import { StatusBadge } from "../catalog-browse/StatusBadge";
import { CasePanel } from "./CasePanel";
import { createServiceLookup, slotViews } from "./board";
import { FeedbackPanel } from "./FeedbackPanel";
import { finishScenario, progressEventText, summaryState } from "./finish";
import { HintAction, showsHintAction } from "./HintAction";
import { Palette } from "./Palette";
import { repositoryUrl, reportIssueUrl } from "./report-issue";
import { createSessionStore } from "./session-store";
import { useGameController, type Names } from "./use-game-controller";

const REPOSITORY = repositoryUrl(import.meta.env.VITE_REPO_URL);

export interface GameScreenProps {
  scenario: Scenario;
  bundle: ContentBundle;
}

export default function GameScreen({ scenario, bundle }: GameScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { rules, catalog } = bundle;
  const [store] = useState(() => {
    const created = createSessionStore();
    created.getState().start(scenario, rules);
    return created;
  });

  const services = useMemo(
    () => new Map<string, Service>(catalog.services.map((s) => [s.id, s])),
    [catalog],
  );
  const serviceLookup = useMemo(() => createServiceLookup(catalog.services), [catalog]);
  const nodes = useMemo(() => new Map(slotNodes(scenario).map((n) => [n.id, n])), [scenario]);
  const names = useMemo(
    (): Names => ({
      serviceName: (id) => services.get(id)?.name ?? id,
      slotRole: (id) => nodes.get(id)?.role ?? id,
    }),
    [services, nodes],
  );
  const palette = useMemo(
    () =>
      buildPalette(scenario, {
        catalog: catalog.services,
        categories: catalog.categories,
        confusionGroups: catalog.confusionGroups,
        rules,
      }),
    [scenario, catalog, rules],
  );

  const game = useGameController(store, names);
  const { session } = game;
  const searchRef = useRef<HTMLInputElement>(null);

  const slots = useMemo(() => slotViews(session), [session]);
  const placed = useMemo(
    () => new Set(session.slots.flatMap((s) => (s.placed === null ? [] : [s.placed]))),
    [session],
  );
  const resolved = session.slots.filter(isSlotResolved).length;
  const { score } = scenarioResult(session);

  const focusSlot = (slotId: string) =>
    document
      .querySelector<HTMLElement>(`[data-slot-id="${slotId}"] [data-slot="architecture-slot-main"]`)
      ?.focus();

  const onSlotActivate = (slotId: string) => {
    const slotFirst = game.pendingServiceId === null;
    game.activateSlot(slotId);
    if (slotFirst) searchRef.current?.focus();
  };

  const onChoose = (serviceId: string) => {
    const target = session.selectedSlotId;
    game.chooseService(serviceId);
    if (target !== null) focusSlot(target);
  };

  const onRetry = (slotId: string) => {
    game.retry(slotId);
    searchRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    // Esc inside a popover or dialog closes it; it does not cancel the selection too.
    if (event.target instanceof Element && event.target.closest("[role=dialog]") !== null) return;
    if (game.cancel()) event.preventDefault();
  };

  const { revealHint } = game;
  const slotHintAction = useCallback(
    (slotId: string) => {
      const node = nodes.get(slotId);
      if (node === undefined) return undefined;
      const revealed = revealedHints(session, slotId);
      const canReveal = canApply(session, commands.useHint(slotId));
      if (!showsHintAction(node.hints.length, revealed.length, canReveal)) return undefined;
      return (
        <HintAction
          role={node.role}
          revealed={revealed}
          total={node.hints.length}
          cost={rules.scoring.hintCost}
          canReveal={canReveal}
          onReveal={() => revealHint(slotId)}
        />
      );
    },
    [nodes, session, rules, revealHint],
  );

  const [finishing, setFinishing] = useState(false);
  const onFinish = async () => {
    setFinishing(true);
    const { progress, replace } = useProgressStore.getState();
    const outcome = await finishScenario({
      session,
      progress,
      rules,
      scenarios: bundle.index.scenarios,
      save: replace,
    });
    if (outcome.saved) {
      for (const event of outcome.events) {
        toast.success(progressEventText(t, event, bundle.index.areas));
      }
    } else {
      toast.warning(t("play.finish.notSaved"), {
        action: { label: t("play.finish.setUp"), onClick: () => void navigate("/bienvenida") },
      });
    }
    void navigate(`/escenarios/${scenario.id}/resumen`, { state: summaryState(outcome) });
  };

  const areaNames = scenario.areas
    .map((id) => bundle.index.areas.find((a) => a.id === id)?.name ?? id)
    .join(" · ");
  const reportSlot = session.selectedSlotId ?? game.feedbackSlotId;

  return (
    <div
      onKeyDown={onKeyDown}
      className="grid h-[calc(100dvh-68px)] grid-rows-[auto_minmax(0,1fr)] overflow-hidden"
    >
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b bg-card px-4 py-2">
        <Button asChild variant="ghost" size="icon">
          <Link to="/escenarios" aria-label={t("play.back")}>
            <ArrowLeftIcon aria-hidden />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <LevelBadge level={scenario.level} variant="solid" />
            <StatusBadge status={scenario.status} />
            <h1 className="truncate text-[1.05rem] font-bold">{scenario.title}</h1>
          </div>
          <p className="mt-[0.15rem] text-[0.75rem] text-muted-foreground">
            <span className="sr-only">{t("scenarios.areas")}: </span>
            {areaNames}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[0.78rem] text-muted-foreground">
          <span>{t("play.top.slots", { resolved, total: session.slots.length })}</span>
          <Progress
            value={session.slots.length === 0 ? 100 : (resolved / session.slots.length) * 100}
            aria-label={t("play.top.progress")}
            className="w-28"
          />
        </div>
        <p className="flex items-center gap-2">
          <StarIcon aria-hidden className="size-5 text-warning" />
          <span className="flex flex-col leading-tight">
            <span className="text-[0.62rem] font-semibold text-muted-foreground uppercase">
              {t("play.top.score")}
            </span>
            <strong className="text-[1.05rem] text-warning tabular-nums">{score}</strong>
          </span>
        </p>
        <a
          href={reportIssueUrl(REPOSITORY, {
            scenarioId: scenario.id,
            version: scenario.version,
            slotId: reportSlot,
          })}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[0.78rem] text-primary underline-offset-4 hover:underline"
        >
          <FlagIcon aria-hidden className="size-4" />
          {t("play.top.report")}
          <span className="sr-only">{t("about.external")}</span>
        </a>
        <Button
          variant="outline"
          disabled={!session.completed || finishing}
          title={session.completed ? undefined : t("play.top.finishHint")}
          onClick={() => void onFinish()}
        >
          {t("play.top.finish")}
        </Button>
      </header>
      <ServiceDndContext
        serviceName={names.serviceName}
        slotRole={names.slotRole}
        renderOverlay={(serviceId) => <DragChip service={services.get(serviceId)} id={serviceId} />}
      >
        <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)_270px]">
          <CasePanel scenario={scenario} />
          <div className="flex min-h-0 min-w-0 flex-col">
            <Diagram
              diagram={scenario.diagram}
              services={serviceLookup}
              slots={slots}
              onSlotActivate={onSlotActivate}
              onServiceDrop={game.drop}
              slotHintAction={slotHintAction}
              label={t("play.board.label", { title: scenario.title })}
              toolbarStart={<BoardStatus completed={session.completed} />}
              className="min-h-0 flex-1"
            />
            <FeedbackPanel
              session={session}
              slotId={game.feedbackSlotId}
              services={services}
              announcement={game.announcement}
              onAccept={game.accept}
              onRetry={onRetry}
              onClose={game.closeFeedback}
            />
          </div>
          <Palette
            serviceIds={palette.services}
            catalog={services}
            categories={catalog.categories}
            placed={placed}
            pendingServiceId={game.pendingServiceId}
            targetRole={
              session.selectedSlotId === null ? null : names.slotRole(session.selectedSlotId)
            }
            onChoose={onChoose}
            searchRef={searchRef}
          />
        </div>
      </ServiceDndContext>
    </div>
  );
}

function BoardStatus({ completed }: { completed: boolean }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-hidden
        className={cn("size-2 rounded-full", completed ? "bg-success" : "bg-primary")}
      />
      {completed ? t("play.board.completed") : t("play.board.inProgress")}
    </span>
  );
}

function DragChip({ service, id }: { service: Service | undefined; id: string }) {
  const name = service?.name ?? id;
  return (
    <span className="flex w-[240px] items-center gap-[0.6rem] rounded-md border border-primary bg-card p-[0.45rem] text-[0.75rem] font-semibold shadow-lg">
      <ServiceIcon
        src={serviceIconSrc(id)}
        name={name}
        category={service?.category ?? ""}
        decorative
      />
      {name}
    </span>
  );
}
