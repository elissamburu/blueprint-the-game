// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Feedback of the slot in focus (RF-EVAL-02, RF-EVAL-03, RF-PLAY-07, RF-PLAY-08), anchored at the
// foot of the board and always visible. It is also the live region of the screen: placements,
// selections and rejections are announced here. Grade, objective statuses and the available
// actions come from game-engine; this component only presents them. Its height is fixed in every
// state, so the board above does not shrink (and hide slots) when an explanation appears.
// Lovable: FeedbackPanel, .feedback-panel, .goal-links (src/components/blueprint-app.tsx, styles.css).
import {
  objectiveStatuses,
  slotNodes,
  slotStatus,
  type SessionState,
  type SlotStatus,
} from "@blueprint/game-engine";
import type { Service } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { gradeLabel } from "@blueprint/ui/components/grade-badge";
import { ObjectiveTag } from "@blueprint/ui/components/objective-tag";
import { Popover, PopoverContent, PopoverTrigger } from "@blueprint/ui/components/popover";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  ExternalLinkIcon,
  MinusIcon,
  MousePointerClickIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { genericExplanation } from "./generic-explanation";
import { InlineMarkdown } from "./InlineMarkdown";

type PlacedStatus = Exclude<SlotStatus, "empty">;

const STYLES: Record<PlacedStatus, { icon: LucideIcon; panel: string; text: string }> = {
  optimal: {
    icon: CircleCheckIcon,
    panel: "border-t-success bg-success-soft",
    text: "text-success",
  },
  acceptable: { icon: MinusIcon, panel: "border-t-warning bg-warning-soft", text: "text-warning" },
  accepted: { icon: MinusIcon, panel: "border-t-warning bg-warning-soft", text: "text-warning" },
  incorrect: {
    icon: CircleXIcon,
    panel: "border-t-destructive bg-danger-soft",
    text: "text-destructive",
  },
};

export interface FeedbackPanelProps {
  session: SessionState;
  slotId: string | null;
  services: ReadonlyMap<string, Service>;
  announcement: { key: number; text: string };
  onAccept: (slotId: string) => void;
  onRetry: (slotId: string) => void;
  onClose: () => void;
}

export function FeedbackPanel({
  session,
  slotId,
  services,
  announcement,
  onAccept,
  onRetry,
  onClose,
}: FeedbackPanelProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const slot = session.slots.find((s) => s.slotId === slotId);
  const node = slotNodes(session.scenario).find((n) => n.id === slotId);
  const evaluation = slot?.evaluation ?? null;
  const status = slot === undefined ? "empty" : slotStatus(slot);

  const live = (
    <p key={announcement.key} className="sr-only">
      {announcement.text}
    </p>
  );

  if (slot === undefined || node === undefined || evaluation === null || status === "empty") {
    return (
      <section
        aria-live="polite"
        aria-label={t("play.feedback.label")}
        data-status="empty"
        className="flex h-[168px] flex-none items-center gap-3 border-t-2 border-t-border bg-card px-6 py-4 text-sm text-muted-foreground"
      >
        {live}
        <MousePointerClickIcon aria-hidden className="size-5 shrink-0" />
        <p>{t("play.feedback.empty")}</p>
      </section>
    );
  }

  const style = STYLES[status];
  const Icon = style.icon;
  const service = services.get(evaluation.serviceId);
  const serviceName = service?.name ?? evaluation.serviceId;
  const explanation =
    evaluation.source === "undeclared"
      ? genericExplanation(t, service ?? { short: serviceName }, evaluation.role)
      : evaluation.rationale;
  const objectives = objectiveStatuses(evaluation, session.scenario.objectives);
  const references = evaluation.source === "answer" ? evaluation.references : [];

  return (
    <section
      aria-live="polite"
      aria-labelledby={titleId}
      data-status={status}
      className={cn(
        "grid h-[168px] flex-none content-start grid-cols-[auto_1fr_auto] gap-x-4 overflow-y-auto border-t-2 px-6 py-4",
        style.panel,
      )}
    >
      {live}
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full border-2 border-current bg-card",
          style.text,
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 id={titleId} className="flex flex-wrap items-center gap-3 text-[1.05rem] font-bold">
          {gradeLabel(evaluation.grade)}
          <span className="rounded-[5px] border bg-card px-2 py-[0.15rem] text-[0.75rem] font-semibold">
            {serviceName}
          </span>
          {status === "accepted" && (
            <span className="text-[0.75rem] font-semibold text-muted-foreground">
              {t("play.feedback.acceptedNote")}
            </span>
          )}
        </h2>
        <p className="mt-1 text-[0.82rem] text-foreground">
          <InlineMarkdown text={explanation} />
        </p>
        {objectives.length > 0 && (
          <ul
            aria-label={t("play.feedback.objectives")}
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1"
          >
            {objectives.map(({ objective, status: objectiveStatus }) => (
              <li key={objective.id}>
                <ObjectiveTag status={objectiveStatus}>{objective.text}</ObjectiveTag>
              </li>
            ))}
          </ul>
        )}
        {(status === "acceptable" || status === "accepted" || status === "incorrect") && (
          <div className="mt-3 flex flex-wrap gap-2">
            {status === "acceptable" && (
              <Button size="sm" onClick={() => onAccept(slot.slotId)}>
                {t("play.feedback.accept")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => onRetry(slot.slotId)}>
              {t("play.feedback.retry")}
            </Button>
          </div>
        )}
      </div>
      <div className="flex flex-col items-end justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t("play.feedback.close")}
          onClick={onClose}
        >
          <XIcon />
        </Button>
        <DocsLink references={references} />
      </div>
    </section>
  );
}

const LINK =
  "inline-flex items-center gap-1 text-[0.75rem] font-semibold text-primary underline-offset-4 hover:underline";

/** "docs.aws.amazon.com/lambda/latest/dg/welcome.html": readable, and says where it goes. */
const referenceLabel = (url: string) => {
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname === "/" ? "" : pathname}`;
};

/** One "Documentación" link; with several references, it opens the list in a popover. */
function DocsLink({ references }: { references: readonly string[] }) {
  const { t } = useTranslation();
  const [first] = references;
  if (first === undefined) return null;
  if (references.length === 1) {
    return (
      <a href={first} target="_blank" rel="noreferrer" className={LINK}>
        {t("play.feedback.docs")}
        <ExternalLinkIcon aria-hidden className="size-3.5" />
        <span className="sr-only">{t("about.external")}</span>
      </a>
    );
  }
  return (
    <Popover>
      <PopoverTrigger className={cn(LINK, "cursor-pointer")}>
        {t("play.feedback.docs")}
        <span className="sr-only">
          {" "}
          ({t("play.feedback.docsCount", { count: references.length })})
        </span>
        <ChevronDownIcon aria-hidden className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" side="top" aria-label={t("play.feedback.docs")} className="w-96">
        <ul className="flex flex-col gap-2">
          {references.map((url) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className={cn(LINK, "break-all")}>
                {referenceLabel(url)}
                <ExternalLinkIcon aria-hidden className="size-3.5 shrink-0" />
                <span className="sr-only">{t("about.external")}</span>
              </a>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
