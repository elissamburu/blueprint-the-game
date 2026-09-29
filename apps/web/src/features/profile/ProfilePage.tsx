// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Profile. For now the rank and XP (RF-GAM-01); the rest of docs/design/pantallas/04 arrives
// with its RFs (badges, mastery and album are F4).
import { rankForXp } from "@blueprint/game-engine";
import { useTranslation } from "react-i18next";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";
import { RequireContent } from "../../content/RequireContent";
import { useProgressStore } from "../../progress/progress-store";

export default function ProfilePage() {
  const { t, i18n } = useTranslation();
  usePageTitle(t("profile.kicker"));
  const xp = useProgressStore((s) => s.progress?.xp ?? 0);
  const format = new Intl.NumberFormat(i18n.language);
  return (
    <PageShell>
      <PageHeading kicker={t("profile.kicker")} title={t("profile.title")} />
      <RequireContent>
        {({ rules }) => (
          <section className="rounded-lg border bg-card p-[1.4rem]">
            <h2 className="section-kicker">{t("profile.rank")}</h2>
            <p className="mt-2 text-2xl">{rankForXp(xp, rules).name}</p>
            <p className="mt-1 text-muted-foreground">
              {t("profile.xp", { xp: format.format(xp) })}
            </p>
          </section>
        )}
      </RequireContent>
      <p className="mt-6 text-muted-foreground">{t("profile.underConstruction")}</p>
    </PageShell>
  );
}
