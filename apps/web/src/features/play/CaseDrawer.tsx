// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Ver caso" (RF-PLAY-01, layout v2): the case on demand, in a side panel over the board with the
// context, restrictions, goals and the steps of the flow. A non-modal dialog: the point is to
// reread the case while looking at the diagram and playing (docs/design, problem 23), so there is
// no scrim, no focus trap, and the board and the palette stay operable (drag & drop included).
// When it opens the focus goes to the panel; Esc (inside it) or the X close it and the focus goes
// back to "Ver caso". A click or a drag outside does not close it. Not built on Radix Dialog: its
// focus scope always loops Tab inside the content, which is a trap for the keyboard.
// Lovable: CaseDrawer, .case-drawer, .case-flow (src/components/blueprint-app.tsx, styles.css),
// captura 14.
import type { FlowStep } from "@blueprint/diagram";
import type { Scenario } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { XIcon } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { CaseContext, CaseObjectives, CaseSteps } from "./CaseContent";
import { Kicker } from "./Kicker";

export interface CaseDrawerProps {
  scenario: Scenario;
  steps: readonly FlowStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The panel is laid over this element (the board and the palette), below the game bar. */
  container: HTMLElement | null;
  /** Where the focus goes back when it closes (the "Ver caso" that opened it). */
  returnFocus: () => void;
}

export function CaseDrawer({
  scenario,
  steps,
  open,
  onOpenChange,
  container,
  returnFocus,
}: CaseDrawerProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLElement>(null);

  // Opening moves the focus to the panel, which is read from its title.
  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open, container]);

  if (!open || container === null) return null;

  const close = () => {
    onOpenChange(false);
    returnFocus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };

  return createPortal(
    <section
      ref={panelRef}
      role="dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // Focusable only by script, so Tab goes through its content and then on to the page.
      tabIndex={-1}
      onKeyDown={onKeyDown}
      data-slot="case-panel"
      className="absolute inset-y-0 left-0 z-40 grid w-[min(26.25rem,92%)] animate-in content-start overflow-y-auto border-r bg-card p-6 shadow-[16px_0_45px_color-mix(in_oklab,var(--foreground)_15%,transparent)] outline-none duration-200 slide-in-from-left motion-reduce:animate-none"
    >
      <header className="flex items-start justify-between gap-4">
        <div>
          <Kicker>{t("play.case.kicker")}</Kicker>
          <h2 id={titleId} className="mt-2 text-[1.35rem] leading-[1.35] font-normal">
            {scenario.title}
          </h2>
        </div>
        <Button variant="ghost" size="icon" aria-label={t("play.case.close")} onClick={close}>
          <XIcon aria-hidden />
        </Button>
      </header>
      <div id={descriptionId} className="mt-4">
        <CaseContext scenario={scenario} />
      </div>
      <CaseObjectives scenario={scenario} />
      <CaseSteps steps={steps} />
    </section>,
    container,
  );
}
