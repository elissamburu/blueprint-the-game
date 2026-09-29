// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game screen (RF-PLAY-01..08, RF-PLAY-13), in its own chunk with React Flow and @dnd-kit
// (ADR-0004, RNF-03). Layout v2 (docs/design, capturas 12–17): the brief when it opens, then a
// single bar instead of the global header, the board over the whole space with the feedback card
// floating on it, and the collapsible palette. "Ver caso" shows the case on demand and focus mode
// hides the bar. Fixed height, no page scroll. Every gesture goes through the adapters of
// src/interaction (ADR-0008) and every grade, score, completion and unlock comes from game-engine.
// Lovable: GameScreen, .game-shell, .game-redesign, .game-layout (src/components/blueprint-app.tsx,
// styles.css).
import { Diagram, diagramSteps, type DiagramHandle } from "@blueprint/diagram";
import {
  buildPalette,
  canApply,
  commands,
  isSlotResolved,
  markScenarioStarted,
  revealedHints,
  scenarioResult,
  slotNodes,
} from "@blueprint/game-engine";
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { toast } from "@blueprint/ui/components/sonner";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useImmersiveLayout } from "../../app/immersive";
import type { ContentBundle } from "../../content/load-bundle";
import { ServiceDndContext } from "../../interaction/drag";
import { useProgressStore } from "../../progress/progress-store";
import { serviceIconSrc } from "../../service-icons";
import { createServiceLookup, slotViews } from "./board";
import { CaseDrawer } from "./CaseDrawer";
import { FeedbackCard, hasFeedback } from "./FeedbackCard";
import { finishScenario, progressEventText, summaryState } from "./finish";
import { FocusBar, GameBar, type GameProgress } from "./GameBar";
import { HintAction, showsHintAction } from "./HintAction";
import { Palette } from "./Palette";
import { repositoryUrl, reportIssueUrl } from "./report-issue";
import { ScenarioBrief } from "./ScenarioBrief";
import { createSessionStore } from "./session-store";
import { PALETTE_COLLAPSED_KEY, useFlagPreference } from "./ui-preferences";
import { useFeedbackPlacement } from "./use-feedback-placement";
import { useFocusMode } from "./use-focus-mode";
import { useGameController, type Names } from "./use-game-controller";

const REPOSITORY = repositoryUrl(import.meta.env.VITE_REPO_URL);
/** A slot reached with Tab is in place once the board's reveal (200 ms) is over. */
const REVEAL_SETTLE_MS = 250;

export interface GameScreenProps {
  scenario: Scenario;
  bundle: ContentBundle;
}

export default function GameScreen({ scenario, bundle }: GameScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useImmersiveLayout();
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
  const steps = useMemo(
    () => diagramSteps(scenario.diagram, serviceLookup),
    [scenario, serviceLookup],
  );
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

  const slots = useMemo(() => slotViews(session), [session]);
  const placed = useMemo(
    () => new Set(session.slots.flatMap((s) => (s.placed === null ? [] : [s.placed]))),
    [session],
  );
  const progress: GameProgress = {
    resolved: session.slots.filter(isSlotResolved).length,
    total: session.slots.length,
    score: scenarioResult(session).score,
    completed: session.completed,
  };

  // The first placement makes the scenario "en curso" in the listing (RF-NAV-01). Without
  // progress nothing is saved, as with the result.
  const started = session.slots.some((slot) => slot.placements > 0);
  useEffect(() => {
    if (!started) return;
    const { progress: stored, replace } = useProgressStore.getState();
    if (stored === null) return;
    const next = markScenarioStarted(stored, scenario.id);
    if (next !== stored) void replace(next);
  }, [started, scenario.id]);

  // Layout v2: brief, "Ver caso", palette collapsed (a browser preference) and focus mode.
  const [briefOpen, setBriefOpen] = useState(true);
  const [caseOpen, setCaseOpen] = useState(false);
  /** Width "Ver caso" covers over the left of the board (0 when closed). */
  const [caseInset, setCaseInset] = useState(0);
  const [paletteCollapsed, setPaletteCollapsed] = useFlagPreference(PALETTE_COLLAPSED_KEY);
  const focus = useFocusMode();
  const [layout, setLayout] = useState<HTMLDivElement | null>(null);
  const diagramRef = useRef<DiagramHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusModeRef = useRef<HTMLButtonElement>(null);
  const exitFocusRef = useRef<HTMLButtonElement>(null);

  // Entering or leaving focus mode unmounts the button that did it: its counterpart takes the
  // focus (only after a change, not when the screen opens).
  const focusChanged = useRef(false);
  useEffect(() => {
    if (!focusChanged.current) return;
    (focus.active ? exitFocusRef : focusModeRef).current?.focus();
  }, [focus.active]);
  const toggleFocus = (enter: boolean) => {
    focusChanged.current = true;
    void (enter ? focus.enter() : focus.exit());
  };

  const boardArea = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const panBoard = useCallback((dx: number, dy: number) => diagramRef.current?.panBy(dx, dy), []);
  const showFeedback = hasFeedback(session, game.feedbackSlotId);
  const placement = useFeedbackPlacement({
    area: boardArea,
    card: cardRef,
    slotId: showFeedback ? game.feedbackSlotId : null,
    openKey: game.announcement.key,
    layoutKey: `${focus.active ? "focus" : "bar"}:${caseInset}`,
    panBoard,
  });

  /**
   * The focus must never land hidden (WCAG 2.4.11): when a slot reached with the keyboard ends up
   * under the card of another slot, the card closes. It checks once the board has panned to the
   * slot (the reveal animates for 200 ms).
   */
  const onBoardFocus = (event: FocusEvent<HTMLDivElement>) => {
    const slot = event.target.closest<HTMLElement>("[data-slot-id]");
    if (slot === null || slot.dataset.slotId === game.feedbackSlotId) return;
    window.setTimeout(() => {
      const card = cardRef.current;
      if (card === null || !slot.isConnected) return;
      const a = card.getBoundingClientRect();
      const b = slot.getBoundingClientRect();
      const covered = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      if (covered && slot.contains(document.activeElement)) game.closeFeedback();
    }, REVEAL_SETTLE_MS);
  };

  const focusSlot = (slotId: string) =>
    document
      .querySelector<HTMLElement>(`[data-slot-id="${slotId}"] [data-slot="architecture-slot-main"]`)
      ?.focus();

  /** The palette takes the focus: its search box or, collapsed, its first service. */
  const focusPalette = () =>
    (
      searchRef.current ??
      document.querySelector<HTMLElement>("[data-palette] [data-palette-service]")
    )?.focus();

  const onSlotActivate = (slotId: string) => {
    const slotFirst = game.pendingServiceId === null;
    game.activateSlot(slotId);
    if (slotFirst) focusPalette();
  };

  const onChoose = (serviceId: string) => {
    const target = session.selectedSlotId;
    game.chooseService(serviceId);
    if (target !== null) focusSlot(target);
  };

  const onRetry = (slotId: string) => {
    game.retry(slotId);
    focusPalette();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    // Esc inside a popover, dialog or menu closes it; it does not cancel the selection too.
    if (
      event.target instanceof Element &&
      event.target.closest("[role=dialog], [role=menu]") !== null
    ) {
      return;
    }
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
    await focus.exit();
    const { progress: stored, replace } = useProgressStore.getState();
    const outcome = await finishScenario({
      session,
      progress: stored,
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

  const areaNames = scenario.areas.map(
    (id) => bundle.index.areas.find((a) => a.id === id)?.name ?? id,
  );
  const reportUrl = reportIssueUrl(REPOSITORY, {
    scenarioId: scenario.id,
    version: scenario.version,
    slotId: session.selectedSlotId ?? game.feedbackSlotId,
  });
  const caseOpener = useRef<HTMLElement | null>(null);
  const actions = {
    caseOpen,
    onViewCase: () => {
      caseOpener.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setCaseOpen(true);
    },
    finishing,
    onFinish: () => void onFinish(),
  };

  return (
    <div
      onKeyDown={onKeyDown}
      data-focus-mode={focus.active ? "" : undefined}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas"
    >
      {!focus.active && (
        <GameBar
          scenario={scenario}
          progress={progress}
          {...actions}
          onFocusMode={() => toggleFocus(true)}
          onPlayFlow={() => diagramRef.current?.playFlow()}
          reportUrl={reportUrl}
          focusModeRef={focusModeRef}
        />
      )}
      <ServiceDndContext
        serviceName={names.serviceName}
        slotRole={names.slotRole}
        renderOverlay={(serviceId) => <DragChip service={services.get(serviceId)} id={serviceId} />}
      >
        <div ref={setLayout} className="relative flex min-h-0 flex-1">
          <div
            ref={boardArea}
            data-slot="board-area"
            onFocus={onBoardFocus}
            className="relative min-h-0 min-w-0 flex-1"
          >
            <Diagram
              ref={diagramRef}
              diagram={scenario.diagram}
              services={serviceLookup}
              slots={slots}
              onSlotActivate={onSlotActivate}
              onServiceDrop={game.drop}
              slotHintAction={slotHintAction}
              label={t("play.board.label", { title: scenario.title })}
              stepList="hidden"
              playButton={false}
              onViewportChange={placement.onViewportChange}
              insetLeft={caseInset}
              className="h-full"
            />
            {focus.active && (
              <FocusBar
                title={scenario.title}
                progress={progress}
                {...actions}
                onExit={() => toggleFocus(false)}
                exitRef={exitFocusRef}
              />
            )}
            {/* The live region of the screen: placements, selections, hints and rejections are
                announced here, and the card that appears inside it is read too. */}
            <div
              aria-live="polite"
              data-slot="feedback-layer"
              // Clear of "Ver caso" while it is open: the card stays usable beside it.
              style={caseInset > 0 ? { left: caseInset } : undefined}
              className="pointer-events-none absolute inset-0 z-20"
            >
              <p key={game.announcement.key} className="sr-only">
                {game.announcement.text}
              </p>
              {showFeedback && (
                <FeedbackCard
                  ref={cardRef}
                  session={session}
                  slotId={game.feedbackSlotId}
                  services={services}
                  side={placement.side}
                  gap={placement.gap}
                  onAccept={game.accept}
                  onRetry={onRetry}
                  onClose={game.closeFeedback}
                />
              )}
            </div>
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
            collapsed={paletteCollapsed}
            onCollapsedChange={setPaletteCollapsed}
            searchRef={searchRef}
          />
        </div>
      </ServiceDndContext>
      <ScenarioBrief
        scenario={scenario}
        areaNames={areaNames}
        services={serviceLookup}
        open={briefOpen}
        onStart={() => setBriefOpen(false)}
        onClosed={() => diagramRef.current?.element()?.focus()}
      />
      <CaseDrawer
        scenario={scenario}
        steps={steps}
        open={caseOpen}
        onOpenChange={setCaseOpen}
        container={layout}
        returnFocus={() => caseOpener.current?.focus()}
        onWidthChange={setCaseInset}
      />
    </div>
  );
}

function DragChip({ service, id }: { service: Service | undefined; id: string }) {
  const name = service?.name ?? id;
  return (
    <span className="flex w-[15rem] items-center gap-[0.6rem] rounded-md border border-primary bg-card p-[0.45rem] text-sm font-semibold shadow-lg">
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
