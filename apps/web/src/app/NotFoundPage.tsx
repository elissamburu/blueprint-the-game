// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Button } from "@blueprint/ui/components/button";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { PageHeading, PageShell, usePageTitle } from "./page";

export default function NotFoundPage() {
  const { t } = useTranslation();
  usePageTitle(t("notFound.title"));
  return (
    <PageShell>
      <PageHeading
        kicker="404"
        title={t("notFound.title")}
        description={t("notFound.description")}
      />
      <Button asChild>
        <Link to="/escenarios">{t("notFound.back")}</Link>
      </Button>
    </PageShell>
  );
}
