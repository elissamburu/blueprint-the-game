// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Tag of a scenario that is not final: "Beta" (RF-NAV-05) and "Borrador", which only shows up
// in development because production never lists drafts.
import type { Scenario } from "@blueprint/scenario-schema";
import { Badge } from "@blueprint/ui/components/badge";
import { useTranslation } from "react-i18next";

export function StatusBadge({ status }: { status: Scenario["status"] }) {
  const { t } = useTranslation();
  switch (status) {
    case "draft":
      return (
        <Badge variant="outline" className="border-warning bg-warning-soft text-warning uppercase">
          {t("status.draft")}
        </Badge>
      );
    case "beta":
      return (
        <Badge variant="secondary" className="uppercase">
          {t("status.beta")}
        </Badge>
      );
    default:
      return null;
  }
}
