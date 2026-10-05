// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The notice of the preview and the answers view while the YAML does not parse or fails the
// schema (ADR-0025 §2): they show the last valid version, and the notice says so with the line of
// the error and a button to go to it. Not a live region: the validation panel already announces it.
import { Button } from "@blueprint/ui/components/button";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { StudioFinding } from "../../shared/validation";

export function DraftProblem({
  problem,
  hasDraft,
  onJump,
}: {
  problem: StudioFinding;
  /** There is a last valid version to show. */
  hasDraft: boolean;
  onJump: (finding: StudioFinding) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      data-draft-problem
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-l-4 border-l-warning bg-warning-soft p-3"
    >
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-warning" />
        {hasDraft
          ? t("draft.invalid", { line: problem.line })
          : t("draft.invalidNoDraft", { line: problem.line })}
      </p>
      <Button variant="outline" size="sm" onClick={() => onJump(problem)}>
        {t("draft.goToLine", { line: problem.line })}
      </Button>
    </div>
  );
}
