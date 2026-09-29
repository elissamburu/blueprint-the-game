// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Ver caso" (RF-PLAY-01, layout v2): the case on demand, in a side panel over the board with the
// context, restrictions, goals and the steps of the flow. A dialog (focus trapped, Esc or X closes
// it and the focus goes back to "Ver caso"), but without darkening the board: the point is to
// reread the case while looking at the diagram (docs/design, problem 23).
// Lovable: CaseDrawer, .case-drawer, .case-flow (src/components/blueprint-app.tsx, styles.css),
// captura 14.
import type { FlowStep } from "@blueprint/diagram";
import type { Scenario } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@blueprint/ui/components/dialog";
import { XIcon } from "lucide-react";
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        container={container}
        showCloseButton={false}
        // No dark scrim (problem 23); a click outside still closes the panel.
        overlayClassName="bg-transparent"
        // There is no DialogTrigger (the button lives in the bar, or in the focus bar).
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
        className="absolute inset-y-0 left-0 grid w-[min(26.25rem,92%)] max-w-none translate-x-0 translate-y-0 content-start gap-0 overflow-y-auto rounded-none border-0 border-r bg-card p-6 shadow-[16px_0_45px_color-mix(in_oklab,var(--foreground)_15%,transparent)] duration-200 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:rounded-none"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <Kicker>{t("play.case.kicker")}</Kicker>
            <DialogTitle className="mt-2 text-[1.35rem] leading-[1.35] font-normal tracking-normal">
              {scenario.title}
            </DialogTitle>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" aria-label={t("play.case.close")}>
              <XIcon aria-hidden />
            </Button>
          </DialogClose>
        </header>
        <DialogDescription asChild>
          <div className="mt-4">
            <CaseContext scenario={scenario} />
          </div>
        </DialogDescription>
        <CaseObjectives scenario={scenario} />
        <CaseSteps steps={steps} />
      </DialogContent>
    </Dialog>
  );
}
