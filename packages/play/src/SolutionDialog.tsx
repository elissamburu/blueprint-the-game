// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The notice before showing a solution (RF-PLAY-14): without a tone of punishment, it invites to
// try a hint first when the slot has one left. "Ver solución completa" asks once for every
// pending slot. Revealing cannot be undone, so it is an AlertDialog: the focus starts on
// "Cancelar" and a click outside does not close it. The screen decides where the focus goes after
// it closes (`onClosed`), after what the player chose. What is revealed and what it scores is
// decided by game-engine (revealSolution, ADR-0024); this only asks.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@blueprint/ui/components/alert-dialog";
import { Button } from "@blueprint/ui/components/button";
import { EyeIcon, LightbulbIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export type SolutionRequest =
  | {
      readonly kind: "slot";
      readonly slotId: string;
      readonly role: string;
      /** The engine would accept useHint for the slot. */
      readonly canUseHint: boolean;
    }
  | { readonly kind: "all"; readonly pending: number };

/** What closed the notice. */
export type SolutionChoice = "cancel" | "hint" | "reveal";

export interface SolutionDialogProps {
  /** The request being asked; it stays set while the notice closes so its text does not jump. */
  request: SolutionRequest | null;
  open: boolean;
  onUseHint: (slotId: string) => void;
  onReveal: (request: SolutionRequest) => void;
  /** The notice closed (Esc and "Cancelar" too): the screen moves the focus. */
  onClosed: (choice: SolutionChoice, request: SolutionRequest) => void;
  onOpenChange: (open: boolean) => void;
}

export function SolutionDialog({
  request,
  open,
  onUseHint,
  onReveal,
  onClosed,
  onOpenChange,
}: SolutionDialogProps) {
  const { t } = useTranslation();
  const choice = useRef<SolutionChoice>("cancel");
  if (request === null) return null;
  const slot = request.kind === "slot" ? request : null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed(choice.current, request);
          choice.current = "cancel";
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(slot === null ? "play.solution.allTitle" : "play.solution.slotTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="flex flex-col gap-2">
              {slot === null ? (
                <>
                  <p>
                    {t("play.solution.all", {
                      count: request.kind === "all" ? request.pending : 0,
                    })}
                  </p>
                  <p>{t("play.solution.allHints")}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-foreground">
                    {t("play.solution.slotRole", { role: slot.role })}
                  </p>
                  <p>
                    {t(
                      slot.canUseHint
                        ? "play.solution.slotWithHints"
                        : "play.solution.slotWithoutHints",
                    )}
                  </p>
                </>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-wrap">
          <AlertDialogCancel>{t("play.solution.cancel")}</AlertDialogCancel>
          {slot?.canUseHint === true && (
            // A plain outline button: AlertDialogAction carries the primary colors.
            <Button
              variant="outline"
              onClick={() => {
                choice.current = "hint";
                onUseHint(slot.slotId);
                onOpenChange(false);
              }}
            >
              <LightbulbIcon aria-hidden />
              {t("play.solution.useHint")}
            </Button>
          )}
          <AlertDialogAction
            onClick={() => {
              choice.current = "reveal";
              onReveal(request);
            }}
          >
            <EyeIcon aria-hidden />
            {t(slot === null ? "play.solution.revealAll" : "play.solution.reveal")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
