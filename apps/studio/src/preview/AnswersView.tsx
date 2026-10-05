// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Respuestas" (RF-STU-09): for the author, the diagram with every slot revealed (its first optimal
// answer, with its grade) and, below it, slot by slot in the order of their numbers, the optimal,
// acceptable and typical incorrect answers with the same list as the solution sheets of the
// printable version (SlotAnswers of @blueprint/play). It follows the draft of the editor live.
// Its own chunk with React Flow, like the game screen.
import { Diagram, type SlotView } from "@blueprint/diagram";
import { createServiceLookup, numberedSlots, SlotAnswers } from "@blueprint/play";
import type { Scenario, Service } from "@blueprint/scenario-schema";
import { useId, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { SharedContent } from "../../shared/api";
import { trimRole } from "./PreviewSummary";
import { studioIconSrc } from "./studio-game-host";

export default function AnswersView({
  scenario,
  shared,
}: {
  scenario: Scenario;
  shared: SharedContent;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const services = useMemo(
    () => new Map<string, Service>(shared.catalog.map((s) => [s.id, s])),
    [shared],
  );
  const lookup = useMemo(() => createServiceLookup(shared.catalog, studioIconSrc), [shared]);
  const slots = useMemo(() => numberedSlots(scenario), [scenario]);
  const views = useMemo(
    () =>
      Object.fromEntries(
        slots.map(({ node, number }): [string, SlotView] => {
          const optimal = node.answers.find((answer) => answer.grade === "optimal");
          return [
            node.id,
            optimal === undefined
              ? { grade: "empty", number }
              : { grade: "optimal", number, serviceId: optimal.service },
          ];
        }),
      ),
    [slots],
  );

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-4">
      <h2 id={titleId} className="text-lg font-semibold">
        {t("answers.title")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("answers.lead")}</p>
      <div className="h-[26rem] shrink-0 overflow-hidden rounded-lg border">
        <Diagram
          // A new layout of the draft fits the picture again.
          key={JSON.stringify(scenario.diagram)}
          diagram={scenario.diagram}
          services={lookup}
          slots={views}
          label={t("answers.diagramLabel", { title: scenario.title })}
          stepList="hidden"
          className="h-full"
        />
      </div>
      {slots.map(({ node, number }) => (
        <SlotSection key={node.id} number={number} role={node.role}>
          <SlotAnswers node={node} scenario={scenario} services={services} />
        </SlotSection>
      ))}
    </section>
  );
}

function SlotSection({
  number,
  role,
  children,
}: {
  number: number;
  role: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  // Not a region: seven of them would crowd the landmarks; the h3 structures them.
  return (
    <div data-slot-number={number} className="rounded-lg border bg-card p-5">
      <h3 className="text-lg font-bold">
        {t("answers.slotTitle", { number, role: trimRole(role) })}
      </h3>
      {children}
    </div>
  );
}
