// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Jugar" (RF-STU-08, ADR-0025 §1): the draft of the editor played with the game screen of
// @blueprint/play, exactly as the game, with the palette of its level. The Studio's GameHost saves
// no progress; "Finalizar" shows the result in this same panel, with "Reiniciar".
// A game plays the version it started with: if the draft changes meanwhile, the game goes on and
// a notice (a status region) offers to restart with the new version.
// The links of the game screen (none here: the host has no exit href nor printable version) would
// resolve against the Studio's own router, which is already around this page: a MemoryRouter
// cannot go inside a data router, and the preview needs no routes of its own.
import type { SessionState } from "@blueprint/game-engine";
import type { GameBundle } from "@blueprint/play";
import type { Scenario } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { PlayIcon, RotateCcwIcon } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PreviewSummary } from "./PreviewSummary";
import { createStudioGameHost } from "./studio-game-host";

/** React Flow and @dnd-kit: the game screen is its own chunk, as in the game (ADR-0004). */
const GameScreen = lazy(() => import("@blueprint/play/game-screen"));

type Phase =
  | { kind: "idle" }
  | { kind: "playing"; scenario: Scenario; game: number }
  | { kind: "finished"; session: SessionState };

export interface PreviewPanelProps {
  /** The last valid scenario of the editor; undefined while there is none. */
  draft: Scenario | undefined;
  bundle: GameBundle;
}

export function PreviewPanel({ draft, bundle }: PreviewPanelProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const startRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const games = useRef(0);

  // After leaving a game or finishing it, the focus goes to what replaced the game screen. Later
  // than the focus a closing dialog of the screen gives back (Radix does it in a timeout).
  const focusTarget =
    phase.kind === "idle" ? startRef : phase.kind === "finished" ? summaryRef : null;
  const moved = useRef(false);
  useEffect(() => {
    if (!moved.current || focusTarget === null) return;
    const timer = window.setTimeout(() => focusTarget.current?.focus());
    return () => window.clearTimeout(timer);
  }, [phase.kind, focusTarget]);

  const play = () => {
    if (draft === undefined) return;
    moved.current = true;
    games.current += 1;
    setPhase({ kind: "playing", scenario: draft, game: games.current });
  };

  const host = useMemo(
    () =>
      createStudioGameHost({
        exitLabel: t("preview.exit"),
        onExit: () => setPhase({ kind: "idle" }),
        onFinish: (session) => setPhase({ kind: "finished", session }),
      }),
    [t],
  );

  const changed = phase.kind === "playing" && draft !== undefined && draft !== phase.scenario;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Always in the page, so the notice is announced when it appears. */}
      <div role="status">
        {changed && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-l-4 border-l-blueprint bg-blueprint-soft p-3">
            <p className="min-w-0 flex-1">{t("preview.changed")}</p>
            <Button variant="outline" size="sm" onClick={play}>
              <RotateCcwIcon aria-hidden />
              {t("preview.restart")}
            </Button>
          </div>
        )}
      </div>

      {phase.kind === "idle" && (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-5">
          <p className="max-w-[40rem]">{t("preview.lead")}</p>
          {draft === undefined ? (
            <p className="text-muted-foreground">{t("preview.noDraft")}</p>
          ) : (
            <Button ref={startRef} onClick={play}>
              <PlayIcon aria-hidden />
              {t("preview.start")}
            </Button>
          )}
        </div>
      )}

      {phase.kind === "playing" && (
        <div
          data-slot="preview-game"
          className="flex min-h-[34rem] flex-1 flex-col overflow-hidden rounded-lg border"
        >
          <Suspense fallback={<p className="p-4">{t("preview.loading")}</p>}>
            <GameScreen key={phase.game} scenario={phase.scenario} bundle={bundle} host={host} />
          </Suspense>
        </div>
      )}

      {phase.kind === "finished" && (
        <PreviewSummary
          session={phase.session}
          services={bundle.catalog.services}
          headingRef={summaryRef}
          onRestart={play}
          canRestart={draft !== undefined}
        />
      )}
    </div>
  );
}
