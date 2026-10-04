// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game screen (RF-PLAY-01..08, RF-PLAY-13..15), in its own chunk with React Flow and @dnd-kit
// (ADR-0004, RNF-03). Layout v2 (docs/design, capturas 12–17): the brief when it opens, then a
// single bar instead of the global header, the board over the whole space with the feedback card
// floating on it, and the collapsible palette. "Ver caso" shows the case on demand and focus mode
// hides the bar. Fixed height, no page scroll. Every gesture goes through the adapters of
// src/interaction (ADR-0008) and every grade, score, completion and unlock comes from game-engine.
// Lovable: GameScreen, .game-shell, .game-redesign, .game-layout (src/components/blueprint-app.tsx,
// styles.css).
import {
  Diagram,
  diagramSteps,
  type DiagramHandle,
  type SlotHintContext,
  useReducedMotion,
} from "@blueprint/diagram";
import {
  buildPalette,
  canApply,
  commands,
  isSlotResolved,
  markScenarioStarted,
  revealedHints,
  scenarioResult,
  slotNodes,
  slotNumbers,
} from "@blueprint/game-engine";
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { EXIT_MS } from "@blueprint/ui/lib/motion";
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
import { finishScenario, summaryState } from "./finish";
import { FocusBar, GameBar, type GameProgress } from "./GameBar";
import { HintAction, showsHintAction } from "./HintAction";
import { Palette } from "./Palette";
import { repositoryUrl, reportIssueUrl } from "./report-issue";
import { ScenarioBrief } from "./ScenarioBrief";
import { createSessionStore } from "./session-store";
import { SolutionDialog, type SolutionChoice, type SolutionRequest } from "./SolutionDialog";
import { PALETTE_COLLAPSED_KEY, useFlagPreference } from "./ui-preferences";
import { useFeedbackPlacement } from "./use-feedback-placement";
import { useFocusMode } from "./use-focus-mode";
import { useGameController, type Names } from "./use-game-controller";
import { usePresence } from "./use-presence";

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
  const numbers = useMemo(() => slotNumbers(scenario), [scenario]);
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

  // The first placement (or viewed solution) makes the scenario "en curso" in the listing
  // (RF-NAV-01). Without progress nothing is saved, as with the result.
  const started = session.slots.some((slot) => slot.placements > 0 || slot.revealed);
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
  const [screenRoot, setScreenRoot] = useState<HTMLDivElement | null>(null);
  const diagramRef = useRef<DiagramHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusModeRef = useRef<HTMLButtonElement>(null);
  const exitFocusRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const finishRef = useRef<HTMLButtonElement>(null);

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
  const reducedMotion = useReducedMotion();
  // The card that closes stays while it sinks out, with what it showed (RF-PLAY-17).
  const feedback = useMemo(
    () =>
      showFeedback && game.feedbackSlotId !== null
        ? { session, slotId: game.feedbackSlotId }
        : null,
    [showFeedback, session, game.feedbackSlotId],
  );
  const card = usePresence(feedback, EXIT_MS + 100);
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
      // The card of this very slot: a placement focuses its slot before the render that opens
      // its card, so `game.feedbackSlotId` above can still be the previous one.
      if (card === null || !slot.isConnected || card.dataset.slotFeedback === slot.dataset.slotId) {
        return;
      }
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

  // "Me quedo con esta" and the X of the card remove the button that had the focus: it goes back
  // to the slot of the card instead of being lost (the next Tab would start from the top).
  const onAccept = (slotId: string) => {
    game.accept(slotId);
    focusSlot(slotId);
  };

  const onCloseFeedback = () => {
    const slotId = game.feedbackSlotId;
    game.closeFeedback();
    if (slotId !== null) focusSlot(slotId);
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
    (slotId: string, { roleId }: SlotHintContext) => {
      const node = nodes.get(slotId);
      const number = numbers.get(slotId);
      if (node === undefined || number === undefined) return undefined;
      const revealed = revealedHints(session, slotId);
      const canReveal = canApply(session, commands.useHint(slotId));
      if (!showsHintAction(node.hints.length, revealed.length, canReveal)) return undefined;
      return (
        <HintAction
          role={node.role}
          slotNumber={number}
          roleId={roleId}
          revealed={revealed}
          total={node.hints.length}
          cost={rules.scoring.hintCost}
          canReveal={canReveal}
          onReveal={() => revealHint(slotId)}
        />
      );
    },
    [nodes, numbers, session, rules, revealHint],
  );

  // "Ver solución" (RF-PLAY-14). The target is the selected slot or, after a placement released
  // the selection, the slot whose feedback is showing. The engine says whether each is possible.
  const solutionTarget = session.selectedSlotId ?? game.feedbackSlotId;
  const [solution, setSolution] = useState<{
    request: SolutionRequest | null;
    open: boolean;
  }>({ request: null, open: false });
  const askSolution = (request: SolutionRequest) => setSolution({ request, open: true });
  const solutionActions = {
    slotAvailable:
      solutionTarget !== null && canApply(session, commands.revealSolution(solutionTarget)),
    allAvailable: canApply(session, commands.revealSolution(null)),
    onSlot: () => {
      if (solutionTarget === null) return;
      askSolution({
        kind: "slot",
        slotId: solutionTarget,
        role: names.slotRole(solutionTarget),
        canUseHint: canApply(session, commands.useHint(solutionTarget)),
      });
    },
    onAll: () =>
      askSolution({
        kind: "all",
        pending: session.slots.filter((slot) => !isSlotResolved(slot)).length,
      }),
  };
  /** Where the focus goes when the notice closes: back to "⋯", or to what changed. */
  const onSolutionClosed = (choice: SolutionChoice, request: SolutionRequest) => {
    if (choice === "cancel") moreRef.current?.focus();
    else if (request.kind === "all") finishRef.current?.focus();
    else if (choice === "hint") {
      // The hint button of the slot, which now opens the revealed hints.
      (
        document.querySelector<HTMLElement>(
          `[data-slot-id="${request.slotId}"] [aria-haspopup=dialog]`,
        ) ?? document.querySelector<HTMLElement>(`[data-slot-id="${request.slotId}"] button`)
      )?.focus();
    } else focusSlot(request.slotId);
  };

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
    // The summary shows and announces the XP, the rank and the unlocks (and says when nothing
    // was saved): toasts on top of it would be read twice.
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
      ref={setScreenRoot}
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
          solution={solutionActions}
          reportUrl={reportUrl}
          focusModeRef={focusModeRef}
          moreRef={moreRef}
          finishRef={finishRef}
          menuContainer={screenRoot}
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
              {card.shown !== null && (
                <FeedbackCard
                  // Another slot: its card comes in.
                  key={card.shown.slotId}
                  ref={card.leaving ? undefined : cardRef}
                  session={card.shown.session}
                  slotId={card.shown.slotId}
                  leaving={card.leaving}
                  onExited={card.exited}
                  reducedMotion={reducedMotion}
                  services={services}
                  side={placement.side}
                  gap={placement.gap}
                  onAccept={onAccept}
                  onRetry={onRetry}
                  onClose={onCloseFeedback}
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
      <SolutionDialog
        request={solution.request}
        open={solution.open}
        onOpenChange={(open) => setSolution((current) => ({ ...current, open }))}
        onUseHint={game.revealHint}
        onReveal={(request) => game.revealSolution(request.kind === "slot" ? request.slotId : null)}
        onClosed={onSolutionClosed}
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
