// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /auth/callback: where the hosted UI returns after signing in (ADR-0029). The layout already
// started the exchange of the code (useAuthStore.init); this page waits for it and goes back to
// where the player was, or says that it failed (the game goes on as a guest).
import { Button } from "@blueprint/ui/components/button";
import { useTranslation } from "react-i18next";
import { Link, Navigate } from "react-router";
import { PageShell, usePageTitle } from "../app/page";
import { Loading } from "../content/RequireContent";
import { useAuthStore } from "./auth-store";

export default function AuthCallbackPage() {
  const { t } = useTranslation();
  usePageTitle(t("auth.callback.title"));
  const status = useAuthStore((s) => s.status);
  const returnTo = useAuthStore((s) => s.returnTo);
  if (status === "signed-in") return <Navigate to={returnTo ?? "/"} replace />;
  if (status === "working") return <Loading label={t("auth.callback.working")} />;
  return (
    <PageShell>
      <div role="alert" className="py-16 text-center">
        <p className="text-lg font-semibold">{t("auth.callback.failed")}</p>
        <Button asChild className="mt-6">
          <Link to="/" replace>
            {t("auth.callback.home")}
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
