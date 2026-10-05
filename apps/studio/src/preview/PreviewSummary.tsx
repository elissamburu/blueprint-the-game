// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The result of a game of the preview, in the same panel (RF-STU-08): the score and the grade of
// each slot, with "Reiniciar". Every number and status comes from game-engine (scenarioResult,
// scenarioReview); nothing is saved.
import { scenarioResult, scenarioReview, type SessionState } from "@blueprint/game-engine";
import type { Service } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { GradeBadge } from "@blueprint/ui/components/grade-badge";
import { formatNumber } from "@blueprint/ui/lib/format";
import { RotateCcwIcon } from "lucide-react";
import { useId, useMemo, type Ref } from "react";
import { useTranslation } from "react-i18next";

export function PreviewSummary({
  session,
  services,
  headingRef,
  onRestart,
  canRestart,
}: {
  session: SessionState;
  services: readonly Service[];
  headingRef: Ref<HTMLHeadingElement>;
  onRestart: () => void;
  /** There is a valid draft to play again. */
  canRestart: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const result = useMemo(() => scenarioResult(session), [session]);
  const review = useMemo(() => scenarioReview(session.scenario, result.slots), [session, result]);
  const names = useMemo(() => new Map(services.map((s) => [s.id, s.name])), [services]);

  return (
    <section
      aria-labelledby={titleId}
      data-slot="preview-summary"
      className="flex flex-col gap-4 rounded-lg border bg-card p-5"
    >
      <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">
        {t("preview.summary.title")}
      </h2>
      <p className="text-lg">
        {t("preview.summary.score", {
          score: formatNumber(result.score),
          max: formatNumber(result.maxScore),
        })}
      </p>
      <p className="text-sm text-muted-foreground">{t("preview.summary.notSaved")}</p>
      <ol aria-label={t("preview.summary.slots")} className="flex flex-col gap-2">
        {review.map((item) => (
          <li
            key={item.slotId}
            data-slot-number={item.number}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border p-3"
          >
            <span className="font-semibold">
              {t("answers.slotTitle", { number: item.number, role: trimRole(item.role) })}
            </span>
            {/* The badge does not decide the grade: accepted is the acceptable the player kept. */}
            <GradeBadge grade={item.status === "accepted" ? "acceptable" : item.status} />
            {item.chosen !== null && <span>{names.get(item.chosen) ?? item.chosen}</span>}
          </li>
        ))}
      </ol>
      <Button className="self-start" onClick={onRestart} disabled={!canRestart}>
        <RotateCcwIcon aria-hidden />
        {t("preview.restart")}
      </Button>
    </section>
  );
}

/** "Lógica que…." → "Lógica que…": the role is a sentence, the title adds its own punctuation. */
export const trimRole = (role: string): string => role.trim().replace(/\.+$/, "");
