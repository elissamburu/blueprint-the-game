// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The case (RF-PLAY-01): context and objectives, with the hard restrictions apart from the soft
// goals. Lovable: .case-panel, .objective-list (src/styles.css), captura docs/design/pantallas/06.
import type { Objective, Scenario } from "@blueprint/scenario-schema";
import { CheckIcon, LockIcon, ShieldCheckIcon, TargetIcon, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { InlineMarkdown } from "./InlineMarkdown";

/** Paragraphs of the context (markdown in the YAML; v1 renders only its inline subset). */
const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p !== "");

export function CasePanel({ scenario }: { scenario: Scenario }) {
  const { t } = useTranslation();
  const hard = scenario.objectives.filter((o) => o.kind === "hard");
  const soft = scenario.objectives.filter((o) => o.kind === "soft");
  return (
    <aside
      aria-label={t("play.case.label")}
      // It scrolls and has nothing focusable: focusable so the keyboard can scroll it.
      tabIndex={0}
      className="flex min-h-0 flex-col overflow-y-auto border-r bg-background p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
    >
      <span className="section-kicker">{t("play.case.kicker")}</span>
      <div className="mt-3 flex flex-col gap-2 text-[0.8rem] leading-relaxed text-muted-foreground">
        {paragraphs(scenario.context).map((p, i) => (
          <p key={i}>
            <InlineMarkdown text={p} />
          </p>
        ))}
      </div>
      <ObjectiveList
        title={t("play.case.restrictions")}
        icon={ShieldCheckIcon}
        itemIcon={LockIcon}
        objectives={hard}
        kind="hard"
      />
      <ObjectiveList
        title={t("play.case.goals")}
        icon={TargetIcon}
        itemIcon={CheckIcon}
        objectives={soft}
        kind="soft"
      />
    </aside>
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
    <section className="mt-5">
      <h2 className="flex items-center gap-2 text-[0.82rem] font-semibold">
        <Icon aria-hidden className="size-4 text-primary" />
        {title}
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {objectives.map((objective) => (
          <li
            key={objective.id}
            data-kind={kind}
            className={
              kind === "hard"
                ? "flex gap-2 rounded-md border border-l-4 border-l-primary bg-card p-3 text-[0.76rem]"
                : "flex gap-2 rounded-md border bg-card p-3 text-[0.76rem]"
            }
          >
            <ItemIcon aria-hidden className="mt-[0.1rem] size-3.5 shrink-0 text-muted-foreground" />
            <span>{objective.text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
