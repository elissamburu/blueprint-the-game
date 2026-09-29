// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "/" sends a new player to the welcome (onboarding) and a returning one to the scenarios. With a
// progress stored by a newer version of the game the onboarding is not offered: the scenarios.
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { Loading } from "../content/RequireContent";
import { useProgressStore } from "../progress/progress-store";

export function RootRedirect() {
  const { t } = useTranslation();
  const status = useProgressStore((s) => s.status);
  const hasProgress = useProgressStore((s) => s.progress !== null || s.incompatible);
  if (status !== "ready") return <Loading label={t("app.loading")} />;
  return <Navigate to={hasProgress ? "/escenarios" : "/bienvenida"} replace />;
}
