// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Validation panel (RF-STU-07). Each finding is a button that takes the cursor to its line.
// Severity goes with an icon and a word, never only color (docs/accesibilidad.md §2), and the
// polite live region announces only the summary ("2 errores, 1 advertencia"), not every item.
// A finding the Studio cannot fix (L022: a plain name of the catalog) says how to fix it.
import { cn } from "@blueprint/ui/lib/utils";
import { CircleCheckIcon, CircleXIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { countFindings, type StudioFinding } from "../../shared/validation";

export interface ValidationPanelProps {
  findings: readonly StudioFinding[] | undefined;
  pending: boolean;
  /** Shown instead of the findings when the validation cannot run. */
  problem?: string;
  onJump: (finding: StudioFinding) => void;
  headingId: string;
  className?: string;
}

/** Findings that the Studio cannot fix, with what to do instead (ADR-0027 §6). */
const NOTES: Readonly<Record<string, "validation.notes.L022">> = {
  L022: "validation.notes.L022",
};

/** How to fix a finding the Studio cannot fix, or nothing. */
export function FindingNote({ code }: { code: string }) {
  const { t } = useTranslation();
  const note = NOTES[code];
  if (note === undefined) return null;
  return <span className="block text-muted-foreground">{t(note)}</span>;
}

export function useSummary(findings: readonly StudioFinding[] | undefined): string {
  const { t } = useTranslation();
  if (findings === undefined) return "";
  const { errors, warnings } = countFindings(findings);
  if (errors === 0 && warnings === 0) return t("validation.summary.ok");
  const errorText = t("validation.summary.errors", { count: errors });
  const warningText = t("validation.summary.warnings", { count: warnings });
  if (warnings === 0) return errorText;
  if (errors === 0) return warningText;
  return t("validation.summary.both", { errors: errorText, warnings: warningText });
}

export function ValidationPanel({
  findings,
  pending,
  problem,
  onJump,
  headingId,
  className,
}: ValidationPanelProps) {
  const { t } = useTranslation();
  const summary = useSummary(findings);
  const ok = findings !== undefined && findings.length === 0;

  return (
    <section aria-labelledby={headingId} className={cn("flex min-h-0 flex-col gap-3", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="text-lg font-semibold">
          {t("validation.title")}
        </h2>
        {pending && findings !== undefined && (
          <span className="text-sm text-muted-foreground">{t("validation.checking")}</span>
        )}
      </div>
      {/* Only the summary is announced, once per new result. */}
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn("flex items-center gap-2 text-base font-medium", ok && "text-success")}
      >
        {ok && <CircleCheckIcon aria-hidden className="size-5 shrink-0" />}
        {problem ?? summary}
      </p>
      {findings !== undefined && findings.length > 0 && (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto pr-1">
          {findings.map((finding, index) => (
            <li key={`${finding.code}-${finding.line}-${finding.column}-${index}`}>
              <FindingButton finding={finding} onJump={onJump} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FindingButton({
  finding,
  onJump,
}: {
  finding: StudioFinding;
  onJump: (finding: StudioFinding) => void;
}) {
  const { t } = useTranslation();
  const error = finding.severity === "error";
  const Icon = error ? CircleXIcon : TriangleAlertIcon;
  return (
    <button
      type="button"
      onClick={() => onJump(finding)}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 rounded-md border border-l-4 bg-card p-3 text-left text-sm hover:bg-muted",
        error ? "border-l-destructive" : "border-l-warning",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
        <Icon
          aria-hidden
          className={cn("size-4 shrink-0", error ? "text-destructive" : "text-warning")}
        />
        <span className={error ? "text-destructive" : "text-warning"}>
          {t(`validation.severity.${finding.severity}`)}
        </span>
        <span className="font-mono">{finding.code}</span>
        <span className="text-muted-foreground">
          {t("validation.line", { line: finding.line })}
        </span>
      </span>
      <span className="text-foreground">
        {finding.message}
        <FindingNote code={finding.code} />
      </span>
      {finding.where !== "" && (
        <span className="font-mono text-sm break-all text-muted-foreground">{finding.where}</span>
      )}
    </button>
  );
}
