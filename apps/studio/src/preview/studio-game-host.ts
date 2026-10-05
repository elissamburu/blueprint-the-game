// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Studio's GameHost (ADR-0025 §1): the game screen of @blueprint/play as it is, with what the
// preview needs. It saves no progress (no onStarted, and "Finalizar" only hands the session to the
// preview, which shows the summary in the same panel), reports no issues, offers no printable
// version and keeps the Studio's layout. The icons come from /icons of the local server, which
// serves them from apps/web/public/icons (ADR-0025 §4).
import type { SessionState } from "@blueprint/game-engine";
import type { GameBundle, GameHost } from "@blueprint/play";
import type { SharedContent } from "../../shared/api";

export const studioIconSrc = (serviceId: string): string => `/icons/${serviceId}.svg`;

export interface StudioGameHostOptions {
  /** Accessible name of the back arrow of the bar and the brief. */
  exitLabel: string;
  /** The back arrow: leaves the game and goes back to the start of the preview. */
  onExit: () => void;
  /** "Finalizar": the preview shows the result of this session. Nothing is saved. */
  onFinish: (session: SessionState) => void;
}

export const createStudioGameHost = ({
  exitLabel,
  onExit,
  onFinish,
}: StudioGameHostOptions): GameHost => ({
  iconSrc: studioIconSrc,
  onFinish: (session) => {
    onFinish(session);
    return Promise.resolve();
  },
  exit: { label: exitLabel, onExit },
});

/** The shared files of the Studio as the content of the game screen: catalog, areas and rules. */
export const gameBundleOf = (shared: SharedContent): GameBundle => ({
  index: { areas: shared.areas },
  catalog: {
    services: shared.catalog,
    categories: shared.categories,
    confusionGroups: shared.confusionGroups,
  },
  rules: shared.gameRules,
});
