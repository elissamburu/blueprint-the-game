// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The answers of one slot, for the solution sheets of the printable version (RF-PLAY-16) and the
// author's answers view of the Studio (RF-STU-09): its optimal, acceptable and typical incorrect
// answers, each with its grade (icon and text), the objectives it meets or violates, why, and the
// official documentation as visible URLs. Every grade and objective status comes from game-engine
// (evaluatePlacement); nothing here decides one. It sends no command: it is not part of a game.
// At level 0 each answer is named «<plainName> (<name>)», with visible parentheses (paper has no
// screen reader), and says where its analogy breaks (RF-PAL-06, RF-EVAL-07).
import {
  evaluatePlacement,
  objectiveStatuses,
  slotNodes,
  slotNumbers,
} from "@blueprint/game-engine";
import type { Scenario, Service, SlotNode } from "@blueprint/scenario-schema";
import { GradeBadge } from "@blueprint/ui/components/grade-badge";
import { ObjectiveTag } from "@blueprint/ui/components/objective-tag";
import { useId, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cardAccessibleName, showsPlainNames } from "./catalog-entry";
import { InlineMarkdown } from "./InlineMarkdown";

export interface NumberedSlot {
  node: SlotNode;
  /** Its number in the scenario (game-engine `slotNumbers`), the one written on its box. */
  number: number;
}

/** The slots of the scenario in the order of their numbers. */
export const numberedSlots = (scenario: Scenario): NumberedSlot[] => {
  const numbers = slotNumbers(scenario);
  return slotNodes(scenario)
    .map((node) => ({ node, number: numbers.get(node.id) ?? 0 }))
    .sort((a, b) => a.number - b.number);
};

export interface SlotAnswersProps {
  node: SlotNode;
  scenario: Scenario;
  services: ReadonlyMap<string, Service>;
}

/** The three groups of answers of a slot, under h4 headings; a group without answers is left out. */
export function SlotAnswers({ node, scenario, services }: SlotAnswersProps) {
  const { t } = useTranslation("play");
  const optimal = node.answers.filter((a) => a.grade === "optimal");
  const acceptable = node.answers.filter((a) => a.grade === "acceptable");
  const answer = (serviceId: string) => (
    <Answer
      key={serviceId}
      node={node}
      serviceId={serviceId}
      scenario={scenario}
      services={services}
    />
  );
  return (
    <>
      <AnswerGroup title={t("answers.optimal")}>
        {optimal.map((a) => answer(a.service))}
      </AnswerGroup>
      <AnswerGroup title={t("answers.acceptable")}>
        {acceptable.map((a) => answer(a.service))}
      </AnswerGroup>
      <AnswerGroup title={t("answers.incorrect")}>
        {node.incorrect.map((i) => answer(i.service))}
      </AnswerGroup>
    </>
  );
}

/** Not a region: every slot repeats these titles, and the h4 already structures them. */
function AnswerGroup({ title, children }: { title: string; children: ReactNode[] }) {
  const titleId = useId();
  if (children.length === 0) return null;
  return (
    <div className="mt-5">
      <h4 id={titleId} className="break-after-avoid text-base font-bold">
        {title}
      </h4>
      <ul aria-labelledby={titleId} className="mt-2 flex flex-col gap-3">
        {children}
      </ul>
    </div>
  );
}

/** One answer of a slot: its grade and objective statuses come from game-engine (evaluatePlacement). */
function Answer({
  node,
  serviceId,
  scenario,
  services,
}: {
  node: SlotNode;
  serviceId: string;
  scenario: Scenario;
  services: ReadonlyMap<string, Service>;
}) {
  const { t } = useTranslation("play");
  const evaluation = evaluatePlacement(node, serviceId);
  if (evaluation.source === "undeclared") return null;
  const objectives = objectiveStatuses(evaluation, scenario.objectives);
  const references = evaluation.source === "answer" ? evaluation.references : [];
  const service = services.get(serviceId);
  const name =
    service === undefined
      ? serviceId
      : cardAccessibleName(service, showsPlainNames(scenario.level));
  const analogyLimit =
    evaluation.source === "answer"
      ? node.answers.find((a) => a.service === serviceId)?.analogyLimit
      : undefined;
  return (
    <li
      data-grade={evaluation.grade}
      className="break-inside-avoid rounded-md border p-4 print:rounded-none print:border-x-0 print:border-t-0 print:px-0"
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <GradeBadge grade={evaluation.grade} />
        <strong className="text-base">{name}</strong>
      </p>
      {objectives.length > 0 && (
        <ul aria-label={t("answers.objectives")} className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {objectives.map(({ objective, status }) => (
            <li key={objective.id}>
              <ObjectiveTag status={status} className="text-sm">
                {objective.text}
              </ObjectiveTag>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-base">
        <strong>{t("answers.why")}</strong> <InlineMarkdown text={evaluation.rationale} />
      </p>
      {analogyLimit !== undefined && (
        <div data-analogy-limit="">
          <p className="mt-2 text-base">
            <strong>{t("answers.analogyLimit")}</strong> <InlineMarkdown text={analogyLimit.text} />
          </p>
          <References title={t("answers.analogyDocs")} urls={analogyLimit.references} />
        </div>
      )}
      <References title={t("answers.docs")} urls={references} />
    </li>
  );
}

/** Official documentation as visible URLs: on paper a link is only what it says. */
function References({ title, urls }: { title: string; urls: readonly string[] }) {
  const { t } = useTranslation("play");
  if (urls.length === 0) return null;
  return (
    <div className="mt-2 text-sm">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 flex flex-col gap-1">
        {urls.map((url) => (
          <li key={url}>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-primary underline underline-offset-4 print:no-underline"
            >
              {url}
              <span className="sr-only"> {t("external")}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
