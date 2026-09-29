// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Welcome for a player without progress. The onboarding form (RF-ONB-01/02) arrives next.
import { Button } from "@blueprint/ui/components/button";
import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "../../app/page";

export default function WelcomePage() {
  const { t } = useTranslation();
  usePageTitle(t("welcome.title"));
  return (
    <PageShell>
      <PageHeading
        kicker={t("welcome.kicker")}
        title={t("welcome.title")}
        description={t("welcome.description")}
      />
      <Button asChild>
        <Link to="/escenarios">
          {t("welcome.browse")} <ArrowRightIcon aria-hidden />
        </Link>
      </Button>
    </PageShell>
  );
}
