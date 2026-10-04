// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Feedback of a slot (RF-EVAL-02, RF-EVAL-03, RF-PLAY-07, RF-PLAY-08, RF-PLAY-14) as a compact card floating
// over the board (layout v2), only while there is something to show: after a placement or when a
// resolved slot is activated. Where it floats (bottom or top) is decided by feedback-placement.ts
// so that it never covers its slot. Grade, objective statuses and the available actions come from
// game-engine; this component only presents them. It rises in and, while it leaves, sinks out
// without being reachable (inert); with reduced motion it only fades (RF-PLAY-17).
// Lovable: FeedbackPanel, .floating-feedback, .feedback-panel, .goal-links
// (src/components/blueprint-app.tsx, styles.css), captura 17.
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
import { motionClass } from "@blueprint/ui/lib/motion";
import { cn } from "@blueprint/ui/lib/utils";
import {
  ChevronDownIcon,
  CircleCheckIcon,
  CircleXIcon,
  ExternalLinkIcon,
  EyeIcon,
  MinusIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react";
import { useId, type Ref } from "react";
import { useTranslation } from "react-i18next";
import type { FeedbackSide } from "./feedback-placement";
import { genericExplanation } from "./generic-explanation";
import { InlineMarkdown } from "./InlineMarkdown";

type PlacedStatus = Exclude<SlotStatus, "empty">;

const STYLES: Record<PlacedStatus, { icon: LucideIcon; panel: string; text: string }> = {
  optimal: { icon: CircleCheckIcon, panel: "border-success bg-success-soft", text: "text-success" },
  acceptable: { icon: MinusIcon, panel: "border-warning bg-warning-soft", text: "text-warning" },
  accepted: { icon: MinusIcon, panel: "border-warning bg-warning-soft", text: "text-warning" },
  incorrect: {
    icon: CircleXIcon,
    panel: "border-destructive bg-danger-soft",
    text: "text-destructive",
  },
  // "Solución vista": explained like a green, but blueprint and a double border, not success.
  revealed: {
    icon: EyeIcon,
    panel: "border-[3px] border-double border-blueprint bg-blueprint-soft",
    text: "text-blueprint",
  },
};

/** Title of the card: the grade, or "Solución vista" for a revealed slot. */
const statusLabel = (status: PlacedStatus) =>
  gradeLabel(status === "accepted" ? "acceptable" : status);

export interface FeedbackCardProps {
  session: SessionState;
  slotId: string | null;
  services: ReadonlyMap<string, Service>;
  onAccept: (slotId: string) => void;
  onRetry: (slotId: string) => void;
  onClose: () => void;
  /** Edge of the board the card floats at, and its distance to it in px. */
  side?: FeedbackSide;
  gap?: number;
  ref?: Ref<HTMLElement> | undefined;
  /**
   * The card is closing: it plays its exit, cannot be focused nor read, and calls `onExited`
   * when the exit ends.
   */
  leaving?: boolean;
  onExited?: () => void;
  /** prefers-reduced-motion: it fades in and out, without moving. */
  reducedMotion?: boolean;
}

/** The slot has an evaluation to explain (it is not empty). */
export const hasFeedback = (session: SessionState, slotId: string | null): boolean => {
  const slot = session.slots.find((s) => s.slotId === slotId);
  return slot !== undefined && slot.evaluation !== null && slotStatus(slot) !== "empty";
};

export function FeedbackCard({
  session,
  slotId,
  services,
  onAccept,
  onRetry,
  onClose,
  side = "bottom",
  gap = 16,
  ref,
  leaving = false,
  onExited,
  reducedMotion = false,
}: FeedbackCardProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const slot = session.slots.find((s) => s.slotId === slotId);
  const node = slotNodes(session.scenario).find((n) => n.id === slotId);
  const evaluation = slot?.evaluation ?? null;
  const status = slot === undefined ? "empty" : slotStatus(slot);
  if (slot === undefined || node === undefined || evaluation === null || status === "empty") {
    return null;
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
  const actions = status === "acceptable" || status === "accepted" || status === "incorrect";
  // A revealed slot shows its first optimal answer; the other optimal ones are named too.
  const alsoOptimal =
    status === "revealed"
      ? node.answers
          .filter((a) => a.grade === "optimal" && a.service !== evaluation.serviceId)
          .map((a) => services.get(a.service)?.name ?? a.service)
      : [];

  return (
    <section
      ref={ref}
      aria-labelledby={titleId}
      data-status={status}
      data-side={side}
      data-slot-feedback={slot.slotId}
      data-leaving={leaving ? "" : undefined}
      inert={leaving}
      aria-hidden={leaving ? true : undefined}
      onAnimationEnd={(event) => {
        if (leaving && event.target === event.currentTarget) onExited?.();
      }}
      style={side === "bottom" ? { bottom: gap } : { top: gap }}
      className={cn(
        "pointer-events-auto absolute left-1/2 grid max-h-[45%] w-[min(47.5rem,calc(100%-2rem))] -translate-x-1/2 grid-cols-[auto_minmax(0,1fr)_auto] gap-x-4 overflow-y-auto rounded-lg border border-t-[3px] px-5 py-4 shadow-[0_18px_45px_color-mix(in_oklab,var(--foreground)_18%,transparent)]",
        style.panel,
        motionClass(leaving ? "exit" : "enter", reducedMotion),
        leaving && "pointer-events-none",
      )}
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-full border-2 border-current bg-card",
          style.text,
        )}
      >
        <Icon aria-hidden className="size-5" />
      </span>
      <div className="min-w-0">
        <h2 id={titleId} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-bold">
          {statusLabel(status)}
          <span className="rounded-[5px] border bg-card px-2 py-[0.15rem] text-sm font-semibold">
            {serviceName}
          </span>
          {status === "accepted" && (
            <span className="text-sm font-semibold text-muted-foreground">
              {t("play.feedback.acceptedNote")}
            </span>
          )}
          {status === "revealed" && (
            <span className="text-sm font-semibold text-muted-foreground">
              {t("play.feedback.revealedNote")}
            </span>
          )}
        </h2>
        <p className="mt-1 text-base text-foreground">
          <InlineMarkdown text={explanation} />
        </p>
        {alsoOptimal.length > 0 && (
          <p className="mt-1 text-base font-semibold text-foreground">
            {t("play.feedback.alsoOptimal", {
              count: alsoOptimal.length,
              services: new Intl.ListFormat("es", { type: "conjunction" }).format(alsoOptimal),
            })}
          </p>
        )}
        {objectives.length > 0 && (
          <ul
            aria-label={t("play.feedback.objectives")}
            className="mt-2 flex flex-wrap gap-x-4 gap-y-1"
          >
            {objectives.map(({ objective, status: objectiveStatus }) => (
              <li key={objective.id}>
                <ObjectiveTag status={objectiveStatus} className="text-sm">
                  {objective.text}
                </ObjectiveTag>
              </li>
            ))}
          </ul>
        )}
        {(actions || references.length > 0) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {status === "acceptable" && (
              <Button size="sm" className="text-sm" onClick={() => onAccept(slot.slotId)}>
                {t("play.feedback.accept")}
              </Button>
            )}
            {actions && (
              <Button
                size="sm"
                variant="outline"
                className="text-sm"
                onClick={() => onRetry(slot.slotId)}
              >
                {t("play.feedback.retry")}
              </Button>
            )}
            <span className="ml-auto">
              <DocsLink references={references} />
            </span>
          </div>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="-mt-1 -mr-2"
        aria-label={t("play.feedback.close")}
        onClick={onClose}
      >
        <XIcon />
      </Button>
    </section>
  );
}

const LINK =
  "inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline";

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
      <PopoverContent
        align="end"
        side="top"
        aria-label={t("play.feedback.docs")}
        className="w-[min(24rem,calc(100vw-2rem))]"
      >
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
