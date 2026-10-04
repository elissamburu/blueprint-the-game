// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The port of the game screen (ADR-0025 §1): what each app that mounts it (the web game, the
// Studio preview) provides. The screen never imports an app: progress, routes, layout, icons and
// the issue link come in through here.
import type { SessionState } from "@blueprint/game-engine";
import type { BundleCatalog, BundleIndex, GameRules } from "@blueprint/scenario-schema";

export interface GameHost {
  /** URL of a catalog service icon; undefined (or a missing file) shows ServiceIcon's fallback. */
  iconSrc: (serviceId: string) => string | undefined;
  /** The first placement or viewed solution. Web: marks the scenario "en curso" (RF-NAV-01). */
  onStarted?: (scenarioId: string) => void;
  /** "Terminar". Web: saves the result and goes to the summary. */
  onFinish: (session: SessionState) => Promise<void>;
  /**
   * The back arrow of the bar and the brief: a link to `href` (a route of the app's router) or,
   * without it, a button that calls `onExit`.
   */
  exit: { label: string; href?: string; onExit?: () => void };
  /** Link of "Reportar un problema" for the slot in play, if any; without it, not offered. */
  reportIssueUrl?: (slotId?: string) => string;
  /**
   * Route of the printable version (a route of the app's router); without it neither the brief
   * nor the "⋯" menu offer it. Added to the sketch of ADR-0025 (see its note).
   */
  printHref?: (scenarioId: string) => string;
  /** Hook called on every render of the screen. Web: the immersive layout. */
  useLayout?: () => void;
}

/** The content the screen needs besides the scenario. */
export interface GameBundle {
  readonly index: Pick<BundleIndex, "areas">;
  readonly catalog: BundleCatalog;
  readonly rules: GameRules;
}
