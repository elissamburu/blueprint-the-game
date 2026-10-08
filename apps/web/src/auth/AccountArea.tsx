// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The account in the top bar (ADR-0029): nothing without a login configured, "Ingresar o crear
// cuenta" for a guest, and the account menu once signed in. The menu (dropdown and dialogs) is a
// chunk of its own: guests never load it.
import { Button } from "@blueprint/ui/components/button";
import { LogInIcon } from "lucide-react";
import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { useAuthStore } from "./auth-store";

const AccountMenu = lazy(() => import("./AccountMenu"));

export function AccountArea() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const signIn = useAuthStore((s) => s.signIn);
  const location = useLocation();
  if (status === "disabled") return null;
  if (status === "signed-in") {
    return (
      <Suspense fallback={<WorkingButton label={t("auth.working")} />}>
        <AccountMenu />
      </Suspense>
    );
  }
  if (status === "working") return <WorkingButton label={t("auth.working")} />;
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void signIn(`${location.pathname}${location.search}`)}
    >
      <LogInIcon aria-hidden />
      {t("auth.signIn")}
    </Button>
  );
}

function WorkingButton({ label }: { label: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      aria-disabled
      aria-busy
      className="aria-disabled:opacity-70"
    >
      {label}
    </Button>
  );
}
