// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /escenarios/:id/resumen. Placeholder with the score and XP of the attempt just finished; the
// full summary (RF-PLAY-09) comes later. The numbers arrive through the navigation state,
// validated at the boundary.
import { Button } from "@blueprint/ui/components/button";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useParams } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { SummaryStateSchema } from "./finish";

export default function SummaryPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const state = SummaryStateSchema.safeParse(useLocation().state);
  usePageTitle(t("play.summary.title"));

  return (
    <PageShell>
      <PageHeading
        kicker={t("play.summary.kicker")}
        title={t("play.summary.title")}
        {...(state.success ? {} : { description: t("play.summary.missing") })}
      />
      {state.success && (
        <dl className="mb-8 grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-lg">
          <dt className="text-muted-foreground">{t("play.summary.score")}</dt>
          <dd className="font-bold tabular-nums">
            {t("play.summary.scoreValue", { score: state.data.score, max: state.data.maxScore })}
          </dd>
          <dt className="text-muted-foreground">{t("play.summary.xp")}</dt>
          <dd className="font-bold tabular-nums">
            {state.data.saved
              ? t("play.summary.xpGained", { xp: state.data.xp, gained: state.data.xpGained })
              : t("play.summary.xpNotSaved", { xp: state.data.xp })}
          </dd>
        </dl>
      )}
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/escenarios">{t("play.back")}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to={`/escenarios/${id}`}>{t("play.summary.replay")}</Link>
        </Button>
      </div>
    </PageShell>
  );
}
