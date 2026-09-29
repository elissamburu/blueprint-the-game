// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Why a scenario is locked, from lockReason of game-engine: "Completá escenarios de nivel N en
// <área>", or without the area when any area counts (RF-NAV-03).
import type { LockReason } from "@blueprint/game-engine";
import { useTranslation } from "react-i18next";

export function LockReasonText({
  lock,
  areaName,
}: {
  lock: LockReason;
  areaName: (areaId: string) => string;
}) {
  const { t } = useTranslation();
  return lock.area === null
    ? t("scenarios.lockReasonAnyArea", { level: lock.level })
    : t("scenarios.lockReason", { level: lock.level, area: areaName(lock.area) });
}
