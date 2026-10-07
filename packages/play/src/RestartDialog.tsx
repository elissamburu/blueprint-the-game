// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Empezar de nuevo" (RF-PLAY-18): discards the game in progress after a confirmation. It cannot
// be undone, so it is an AlertDialog like the solution notice: the focus starts on "Cancelar" and
// a click outside does not close it. The screen decides where the focus goes after it closes.
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
import { buttonVariants } from "@blueprint/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

export interface RestartDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  /** The notice closed (Esc and "Cancelar" too): the screen moves the focus. */
  onClosed: (confirmed: boolean) => void;
}

export function RestartDialog({ open, onOpenChange, onConfirm, onClosed }: RestartDialogProps) {
  const { t } = useTranslation("play");
  const confirmed = useRef(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed(confirmed.current);
          confirmed.current = false;
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("restart.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("restart.text")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("restart.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => {
              confirmed.current = true;
              onConfirm();
            }}
          >
            <RotateCcwIcon aria-hidden />
            {t("restart.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
