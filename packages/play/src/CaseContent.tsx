// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The case (RF-PLAY-01): context, restrictions apart from goals, and the steps of the flow. Shown
// by the brief when the scenario opens and by "Ver caso" on demand. Goals carry a neutral target
// icon: the check means "met" and belongs to the feedback only (docs/design, problem 21).
// Lovable: .objective-block, .objective, .case-flow (src/styles.css), capturas 12 y 14.
import { describeRoute, type FlowStep } from "@blueprint/diagram";
import type { Objective, Scenario } from "@blueprint/scenario-schema";
import { cn } from "@blueprint/ui/lib/utils";
import {
  CircleDotIcon,
  LockIcon,
  PlayIcon,
  ShieldCheckIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { InlineMarkdown } from "./InlineMarkdown";

/** Paragraphs of the context (markdown in the YAML; v1 renders only its inline subset). */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p !== "");

export function CaseContext({ scenario, id }: { scenario: Scenario; id?: string }) {
  return (
    <div id={id} className="flex flex-col gap-3 text-base leading-relaxed text-muted-foreground">
      {paragraphs(scenario.context).map((p, i) => (
        <p key={i}>
          <InlineMarkdown text={p} />
        </p>
      ))}
    </div>
  );
}

/** Restrictions (hard) and goals (soft), each list under its own heading. */
export function CaseObjectives({
  scenario,
  className,
}: {
  scenario: Scenario;
  className?: string;
}) {
  const { t } = useTranslation("play");
  const hard = scenario.objectives.filter((o) => o.kind === "hard");
  const soft = scenario.objectives.filter((o) => o.kind === "soft");
  return (
    <div className={className}>
      <ObjectiveList
        title={t("case.restrictions")}
        icon={ShieldCheckIcon}
        itemIcon={LockIcon}
        objectives={hard}
        kind="hard"
      />
      <ObjectiveList
        title={t("case.goals")}
        icon={TargetIcon}
        itemIcon={CircleDotIcon}
        objectives={soft}
        kind="soft"
      />
    </div>
  );
}

function ObjectiveList({
  title,
  icon: Icon,
  itemIcon: ItemIcon,
  objectives,
  kind,
}: {
  title: string;
  icon: LucideIcon;
  itemIcon: LucideIcon;
  objectives: readonly Objective[];
  kind: Objective["kind"];
}) {
  if (objectives.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon aria-hidden className="size-4 text-primary" />
        {title}
      </h3>
      <ul className="mt-3 flex flex-col gap-2">
        {objectives.map((objective) => (
          <li
            key={objective.id}
            data-kind={kind}
            className={cn(
              "flex gap-2 rounded-md border bg-background p-3 text-sm",
              kind === "hard" && "border-l-4 border-l-primary",
            )}
          >
            <ItemIcon
              aria-hidden
              className={cn(
                "mt-[0.15rem] size-4 shrink-0",
                kind === "hard" ? "text-success" : "text-muted-foreground",
              )}
            />
            <span>{objective.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The steps of the flow with their routes (Lovable: .case-flow). */
export function CaseSteps({ steps }: { steps: readonly FlowStep[] }) {
  const { t } = useTranslation("play");
  if (steps.length === 0) return null;
  return (
    <section className="mt-6">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <PlayIcon aria-hidden className="size-4 text-primary" />
        {t("case.steps")}
      </h3>
      <ol className="mt-3 flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.step}
            data-step={step.step}
            className="grid grid-cols-[1.5rem_1fr] items-start gap-[0.6rem] rounded-md border bg-background p-3"
          >
            <span
              aria-hidden
              className="grid size-6 place-items-center rounded-full bg-primary text-sm font-[850] text-primary-foreground"
            >
              {step.step}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                <span className="sr-only">{t("case.step", { step: step.step })} </span>
                {step.labels.join(" / ")}
              </p>
              {step.routes.map((route) => (
                <p key={describeRoute(route)} className="mt-1 text-sm text-muted-foreground">
                  {describeRoute(route)}
                </p>
              ))}
              {step.descriptions.map((description) => (
                <p key={description} className="mt-1 text-base">
                  {description}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
