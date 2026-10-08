// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Menu of a signed-in player (ADR-0029): the visible name, the email and the XP, "Cambiar nombre
// visible", "Cerrar sesión" and "Eliminar mi cuenta". Radix gives the menu and the dialogs their
// keyboard handling and focus (they return the focus to the menu button when they close). The XP
// is the one of the progress store (computed by game-engine), never recomputed here.
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
import { Button, buttonVariants } from "@blueprint/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@blueprint/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@blueprint/ui/components/dropdown-menu";
import { Input } from "@blueprint/ui/components/input";
import { Label } from "@blueprint/ui/components/label";
import { toast } from "@blueprint/ui/components/sonner";
import { formatNumber } from "@blueprint/ui/lib/format";
import { ChevronDownIcon, LogOutIcon, PencilIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { useId, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { useProgressStore } from "../progress/progress-store";
import { useAuthStore } from "./auth-store";
import { DISPLAY_NAME_MAX } from "./limits";

type OpenDialog = "name" | "delete" | null;

export default function AccountMenu() {
  const { t } = useTranslation();
  const account = useAuthStore((s) => s.account);
  const signOut = useAuthStore((s) => s.signOut);
  const xp = useProgressStore((s) => s.progress?.xp ?? 0);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  if (account === null) return null;
  // The dialogs open from an item that is gone when they close: the focus goes back to the
  // menu button, as with "⋯" of the game screen.
  const returnFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
  const name = account.displayName ?? t("auth.menu");
  return (
    <>
      {/* Not modal, like "⋯" of the game screen: the rest of the page is not hidden from
          assistive technologies while it is open; Esc, a click outside and the focus work alike. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            size="sm"
            variant="outline"
            aria-label={t("auth.menuLabel", { name })}
          >
            <UserRoundIcon aria-hidden />
            <span className="max-w-[12ch] truncate">{name}</span>
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-64">
          {/* Not an item: read by the menu's label, skipped by the arrow keys. */}
          <div className="px-2 py-1.5 text-sm">
            <p className="font-semibold break-words">{name}</p>
            <p className="break-all text-muted-foreground">{account.email}</p>
            <p className="mt-1 font-semibold">{t("auth.xp", { xp: formatNumber(xp) })}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("name")}>
            <PencilIcon aria-hidden />
            {t("auth.editName")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void signOut()}>
            <LogOutIcon aria-hidden />
            {t("auth.signOut")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setDialog("delete")}
          >
            <Trash2Icon aria-hidden />
            {t("auth.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DisplayNameDialog
        open={dialog === "name"}
        current={account.displayName ?? ""}
        onClose={() => setDialog(null)}
        onCloseAutoFocus={returnFocus}
      />
      <DeleteAccountDialog
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        onCloseAutoFocus={returnFocus}
      />
    </>
  );
}

function DisplayNameDialog({
  open,
  current,
  onClose,
  onCloseAutoFocus,
}: {
  open: boolean;
  current: string;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useTranslation();
  const save = useAuthStore((s) => s.saveDisplayName);
  const id = useId();
  const [value, setValue] = useState(current);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = value.trim();
    if (name === "") return setProblem(t("auth.nameDialog.empty"));
    if (name.length > DISPLAY_NAME_MAX) {
      return setProblem(t("auth.nameDialog.tooLong", { max: DISPLAY_NAME_MAX }));
    }
    setSaving(true);
    const ok = await save(name);
    setSaving(false);
    if (!ok) return setProblem(t("auth.errors.display-name"));
    toast.success(t("auth.nameDialog.saved"));
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        setValue(current);
        setProblem(null);
        onClose();
      }}
    >
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <DialogHeader>
            <DialogTitle>{t("auth.nameDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("auth.nameDialog.description", { max: DISPLAY_NAME_MAX })}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <Label htmlFor={`${id}-name`}>{t("auth.nameDialog.label")}</Label>
            <Input
              id={`${id}-name`}
              value={value}
              autoComplete="nickname"
              maxLength={DISPLAY_NAME_MAX * 2}
              aria-invalid={problem !== null}
              aria-describedby={problem === null ? undefined : `${id}-problem`}
              onChange={(event) => {
                setValue(event.target.value);
                setProblem(null);
              }}
            />
            <p id={`${id}-problem`} role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t("auth.nameDialog.cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" aria-disabled={saving}>
              {saving ? t("auth.working") : t("auth.nameDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteAccountDialog({
  open,
  onClose,
  onCloseAutoFocus,
}: {
  open: boolean;
  onClose: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const { t } = useTranslation();
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  const confirm = async () => {
    setDeleting(true);
    const ok = await deleteAccount();
    setDeleting(false);
    onClose();
    if (!ok) return;
    toast.success(t("auth.deleteDialog.done"));
    void navigate("/");
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && !deleting && onClose()}>
      <AlertDialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("auth.deleteDialog.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("auth.deleteDialog.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>{t("auth.deleteDialog.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            aria-disabled={deleting}
            onClick={(event) => {
              // Closes when the deletion ends, not on click.
              event.preventDefault();
              if (!deleting) void confirm();
            }}
          >
            {deleting ? t("auth.working") : t("auth.deleteDialog.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
