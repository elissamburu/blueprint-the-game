// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Glue between the interaction adapters, the session store and the screen: dispatches the
// commands each gesture maps to, remembers which slot the feedback panel shows and what to
// announce. It never decides grades: the engine answers every command.
import {
  commands,
  type Command,
  type CommandOutcome,
  type SessionState,
} from "@blueprint/game-engine";
import { gradeLabel } from "@blueprint/ui/components/grade-badge";
import type { TFunction } from "i18next";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore, type StoreApi } from "zustand";
import {
  activateSlot as activateSlotStep,
  cancelSelection,
  chooseService as chooseServiceStep,
  dropService,
  type InteractionStep,
} from "./interaction/adapters";
import type { SessionStoreState } from "./session-store";

export interface Names {
  serviceName: (serviceId: string) => string;
  slotRole: (slotId: string) => string;
}

/** Text for the live region after a command; empty when there is nothing to say. */
export const announceOutcome = (
  t: TFunction<"play">,
  outcome: CommandOutcome,
  names: Names,
): string => {
  switch (outcome.type) {
    case "slotSelected":
      return outcome.slotId === null
        ? t("announce.deselected")
        : t("announce.selected", { role: names.slotRole(outcome.slotId) });
    case "servicePlaced":
      return t("announce.placed", {
        service: names.serviceName(outcome.evaluation.serviceId),
        role: names.slotRole(outcome.slotId),
        grade: gradeLabel(outcome.evaluation.grade),
      });
    case "acceptableAccepted":
      return t("announce.accepted", { role: names.slotRole(outcome.slotId) });
    case "slotCleared":
      return t("announce.cleared", { role: names.slotRole(outcome.slotId) });
    case "hintRevealed":
      return t("announce.hint", { number: outcome.index + 1, hint: outcome.hint });
    case "solutionRevealed": {
      // One slot names its solution; "Ver solución completa" only says how many, once.
      const [only] = outcome.revealed;
      return outcome.revealed.length === 1 && only !== undefined
        ? t("announce.solutionRevealed", {
            role: names.slotRole(only.slotId),
            service: names.serviceName(only.serviceId),
          })
        : t("announce.solutionsRevealed", { count: outcome.revealed.length });
    }
    case "rejected":
      return t(`announce.rejected.${outcome.reason}`);
  }
};

export interface GameController {
  readonly session: SessionState;
  readonly pendingServiceId: string | null;
  /** Slot whose evaluation the feedback panel shows. */
  readonly feedbackSlotId: string | null;
  /** Latest announcement; `key` changes on every announcement so a repeated text is read again. */
  readonly announcement: { readonly key: number; readonly text: string };
  drop: (slotId: string, serviceId: string) => void;
  activateSlot: (slotId: string) => void;
  chooseService: (serviceId: string) => void;
  /** Esc. Returns whether there was a selection to cancel. */
  cancel: () => boolean;
  accept: (slotId: string) => void;
  /** "Probar otra": empties the slot and selects it for the next service. */
  retry: (slotId: string) => void;
  revealHint: (slotId: string) => void;
  /** "Ver solución" of one slot, or of every unresolved slot with null (RF-PLAY-14). */
  revealSolution: (slotId: string | null) => void;
  /** "Empezar de nuevo" (RF-PLAY-18): the board empties and nothing stays selected. */
  restart: () => void;
  closeFeedback: () => void;
}

export const useGameController = (
  store: StoreApi<SessionStoreState>,
  names: Names,
): GameController => {
  const { t } = useTranslation("play");
  const session = useStore(store, (s) => s.session);
  if (session === null) throw new Error("useGameController needs a started session");
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [feedbackSlotId, setFeedbackSlotId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState({ key: 0, text: "" });

  const announce = useCallback((text: string) => {
    if (text !== "") setAnnouncement((previous) => ({ key: previous.key + 1, text }));
  }, []);

  const run = useCallback(
    (cmds: readonly Command[]) => {
      let last = "";
      for (const command of cmds) {
        const outcome = store.getState().dispatch(command);
        if (outcome === null) continue;
        if (outcome.type === "servicePlaced") setFeedbackSlotId(outcome.slotId);
        // One revealed slot shows its explanation next to it; the whole solution shows none.
        if (outcome.type === "solutionRevealed") {
          const [only] = outcome.revealed;
          setFeedbackSlotId(
            outcome.revealed.length === 1 && only !== undefined ? only.slotId : null,
          );
        }
        if (outcome.type === "slotSelected" && outcome.slotId !== null) {
          setFeedbackSlotId(outcome.slotId);
        }
        // The release after a placement is not news: the placement is.
        const releasing = outcome.type === "slotSelected" && outcome.slotId === null && last !== "";
        if (!releasing) last = announceOutcome(t, outcome, names) || last;
        if (outcome.type === "rejected") break;
      }
      announce(last);
    },
    [store, t, names, announce],
  );

  const apply = useCallback(
    (step: InteractionStep) => {
      setPendingServiceId(step.pendingServiceId);
      run(step.commands);
    },
    [run],
  );

  const interaction = () => ({
    selectedSlotId: store.getState().session?.selectedSlotId ?? null,
    pendingServiceId,
  });

  return {
    session,
    pendingServiceId,
    feedbackSlotId,
    announcement,
    drop: (slotId, serviceId) => apply(dropService(slotId, serviceId)),
    activateSlot: (slotId) => apply(activateSlotStep(interaction(), slotId)),
    chooseService: (serviceId) => {
      const step = chooseServiceStep(interaction(), serviceId);
      apply(step);
      if (step.commands.length === 0) {
        announce(
          step.pendingServiceId === null
            ? t("announce.serviceDropped")
            : t("announce.servicePicked", { service: names.serviceName(serviceId) }),
        );
      }
    },
    cancel: () => {
      const state = interaction();
      if (state.selectedSlotId === null && state.pendingServiceId === null) return false;
      apply(cancelSelection(state));
      if (state.selectedSlotId === null) announce(t("announce.deselected"));
      return true;
    },
    accept: (slotId) => run([commands.acceptAcceptable(slotId)]),
    retry: (slotId) => {
      setPendingServiceId(null);
      run([commands.clearSlot(slotId), commands.selectSlot(slotId)]);
    },
    revealHint: (slotId) => run([commands.useHint(slotId)]),
    revealSolution: (slotId) => {
      setPendingServiceId(null);
      run([commands.revealSolution(slotId)]);
    },
    restart: () => {
      setPendingServiceId(null);
      setFeedbackSlotId(null);
      store.getState().restart();
      announce(t("announce.restarted"));
    },
    closeFeedback: () => setFeedbackSlotId(null),
  };
};
