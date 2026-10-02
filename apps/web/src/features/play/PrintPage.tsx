// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /escenarios/:id/imprimir (RF-PLAY-16): the scenario to solve on paper, printed (or saved as PDF)
// from the browser, with no server and no new dependencies. Sheet 1: the case and its objectives.
// Sheet 2: the diagram with its slots empty and numbered, the steps of the flow and the list of
// slots (its text alternative). With "Incluir soluciones", one sheet per slot with its optimal,
// acceptable and typical incorrect answers, why, and the official documentation as visible URLs.
// It sits behind the same gate as the game (ScenarioGate) and sends no command to game-engine:
// opening or printing it changes neither a session, nor the progress, nor the score. Solutions
// do not go through revealSolution: the page is for studying, not part of a game.
// The page controls, the header and the notices of the site are not printed (print:hidden).
import {
  evaluatePlacement,
  objectiveStatuses,
  slotNodes,
  slotNumbers,
} from "@blueprint/game-engine";
import { Diagram, flowSteps, nodeName, printLayout, type SlotView } from "@blueprint/diagram";
import type { Scenario, Service, SlotNode } from "@blueprint/scenario-schema";
import { Button } from "@blueprint/ui/components/button";
import { GradeBadge } from "@blueprint/ui/components/grade-badge";
import { LevelBadge } from "@blueprint/ui/components/level-badge";
import { ObjectiveTag } from "@blueprint/ui/components/objective-tag";
import { cn } from "@blueprint/ui/lib/utils";
import { ArrowLeftIcon, ClockIcon, PrinterIcon } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router";
import type { ContentBundle } from "../../content/load-bundle";
import { createServiceLookup } from "./board";
import { CaseContext, CaseObjectives } from "./CaseContent";
import { InlineMarkdown } from "./InlineMarkdown";
import "./print.css";
import { ScenarioGate } from "./ScenarioGate";

export default function PrintPage() {
  const { id = "" } = useParams();
  return (
    <ScenarioGate id={id}>
      {(scenario, bundle) => <PrintView scenario={scenario} bundle={bundle} />}
    </ScenarioGate>
  );
}

/** Each sheet starts a new page; on screen it is a card. */
const SHEET =
  "print-sheet break-before-page rounded-xl border bg-card p-6 text-card-foreground md:p-10 print:rounded-none print:border-0 print:p-0";

interface PrintSlot {
  node: SlotNode;
  number: number;
}

export function PrintView({ scenario, bundle }: { scenario: Scenario; bundle: ContentBundle }) {
  const { t } = useTranslation();
  const [solutions, setSolutions] = useState(false);
  const hintId = useId();
  const services = useMemo(
    () => new Map<string, Service>(bundle.catalog.services.map((s) => [s.id, s])),
    [bundle],
  );
  const slots = useMemo((): PrintSlot[] => {
    const numbers = slotNumbers(scenario);
    return slotNodes(scenario)
      .map((node) => ({ node, number: numbers.get(node.id) ?? 0 }))
      .sort((a, b) => a.number - b.number);
  }, [scenario]);
  const areaNames = scenario.areas.map(
    (areaId) => bundle.index.areas.find((a) => a.id === areaId)?.name ?? areaId,
  );

  return (
    <div className="mx-auto max-w-[1180px] px-4 pt-8 pb-24 md:px-8 print:max-w-none print:p-0">
      <section
        aria-label={t("play.print.controls")}
        className="mb-8 flex flex-col gap-5 print:hidden"
      >
        <Button asChild variant="outline" className="self-start">
          <Link to={`/escenarios/${scenario.id}`}>
            <ArrowLeftIcon aria-hidden /> {t("play.print.back")}
          </Link>
        </Button>
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <span className="section-kicker">{t("play.print.kicker")}</span>
            <p className="max-w-[46rem] text-muted-foreground">{t("play.print.lead")}</p>
            <div className="mt-2 flex items-start gap-3">
              <input
                id={`${hintId}-solutions`}
                type="checkbox"
                checked={solutions}
                onChange={(event) => setSolutions(event.target.checked)}
                aria-describedby={hintId}
                className="mt-[0.2rem] size-5 shrink-0 accent-primary"
              />
              <div>
                <label htmlFor={`${hintId}-solutions`} className="font-semibold">
                  {t("play.print.includeSolutions")}
                </label>
                <p id={hintId} className="text-sm text-muted-foreground">
                  {t("play.print.includeSolutionsHint")}
                </p>
              </div>
            </div>
          </div>
          <Button
            size="lg"
            className="self-start text-base md:self-center"
            onClick={() => window.print()}
          >
            <PrinterIcon aria-hidden />
            {t("play.print.print")}
          </Button>
        </div>
      </section>

      <article className="print-doc flex flex-col gap-8 print:block">
        <CaseSheet scenario={scenario} areaNames={areaNames} />
        <DiagramSheet scenario={scenario} bundle={bundle} slots={slots} />
        {solutions && <SolutionSheets scenario={scenario} slots={slots} services={services} />}
      </article>
    </div>
  );
}

function CaseSheet({ scenario, areaNames }: { scenario: Scenario; areaNames: readonly string[] }) {
  const { t } = useTranslation();
  const caseId = useId();
  return (
    <section data-print-sheet="case" aria-labelledby={caseId} className={SHEET}>
      <header className="flex flex-col gap-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold">
          <LevelBadge level={scenario.level} className="text-sm" />
          <span>
            {t("play.print.areas")}: {areaNames.join(", ")}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon aria-hidden className="size-4" />
            {t("play.print.minutes", { count: scenario.estimatedMinutes })}
          </span>
        </p>
        <h1 className="text-[2rem] leading-tight">{scenario.title}</h1>
      </header>
      <h2 id={caseId} className="mt-6 text-xl font-bold">
        {t("play.print.caseTitle")}
      </h2>
      <div className="mt-3">
        <CaseContext scenario={scenario} />
      </div>
      <CaseObjectives
        scenario={scenario}
        className="grid gap-x-6 sm:grid-cols-2 print:grid-cols-2 print:[&_li]:break-inside-avoid print:[&_li]:p-2"
      />
    </section>
  );
}

function DiagramSheet({
  scenario,
  bundle,
  slots,
}: {
  scenario: Scenario;
  bundle: ContentBundle;
  slots: readonly PrintSlot[];
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const stepsId = useId();
  const slotsId = useId();
  const lookup = useMemo(() => createServiceLookup(bundle.catalog.services), [bundle]);
  const layout = useMemo(() => printLayout(scenario.diagram), [scenario]);
  const labels = useMemo(() => ({ size: layout.labelSize, min: layout.minLabelSize }), [layout]);
  const views = useMemo(
    () =>
      Object.fromEntries(
        slots.map(({ node, number }): [string, SlotView] => [node.id, { grade: "empty", number }]),
      ),
    [slots],
  );
  // The steps name a slot by its number, the one written on its box.
  const steps = useMemo(() => {
    const numbers = new Map(slots.map(({ node, number }) => [node.id, number]));
    const nodes = new Map(scenario.diagram.nodes.map((n) => [n.id, n]));
    return flowSteps(scenario.diagram.edges, (nodeId) => {
      const number = numbers.get(nodeId);
      if (number !== undefined) return t("play.print.slot", { number });
      const node = nodes.get(nodeId);
      return node === undefined ? nodeId : nodeName(node, lookup);
    });
  }, [scenario, slots, lookup, t]);

  return (
    <section
      data-print-sheet="diagram"
      data-orientation={layout.orientation}
      aria-labelledby={titleId}
      className={cn(SHEET, "group")}
    >
      <h2 id={titleId} className="text-xl font-bold">
        {t("play.print.diagramTitle")}
      </h2>
      <p className="mt-1 text-muted-foreground">{t("play.print.diagramLead")}</p>
      {/* In px: the picture has the size of the printable area of the sheet (printLayout), which
          is what the printed page fits. On a narrow screen it scrolls (two-dimensional content). */}
      <div className="mt-4 overflow-x-auto print:overflow-visible">
        <div style={{ width: layout.width, height: layout.height }} className="mx-auto">
          <Diagram
            print
            diagram={scenario.diagram}
            services={lookup}
            slots={views}
            printLabels={labels}
            label={t("play.print.diagramLabel")}
            describedBy={steps.length > 0 ? `${stepsId} ${slotsId}` : slotsId}
            className="size-full"
          />
        </div>
      </div>
      {steps.length > 0 && (
        <section aria-labelledby={`${stepsId}-title`} className="mt-5 break-inside-avoid">
          <h3 id={`${stepsId}-title`} className="break-after-avoid text-base font-bold">
            {t("play.case.steps")}
          </h3>
          <ol
            id={stepsId}
            className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 print:grid-cols-2 print:group-data-[orientation=landscape]:grid-cols-3"
          >
            {steps.map((step) => (
              <li key={step.step} data-step={step.step} className="flex gap-2 break-inside-avoid">
                <NumberMark>{step.step}</NumberMark>
                <span>
                  <span className="sr-only">{t("play.case.step", { step: step.step })} </span>
                  <strong>{step.labels.join(" / ")}</strong>
                  {step.routes.map((route) => (
                    <span key={`${route.from}-${route.to}`} className="block">
                      {route.from} → {route.to}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}
      <section aria-labelledby={`${slotsId}-title`} className="mt-5 break-inside-avoid">
        <h3 id={`${slotsId}-title`} className="break-after-avoid text-base font-bold">
          {t("play.print.slots")}
        </h3>
        <ol id={slotsId} className="mt-2 grid gap-y-1 text-sm">
          {slots.map(({ node, number }) => (
            <li key={node.id} data-slot-number={number} className="flex gap-2 break-inside-avoid">
              <NumberMark>{number}</NumberMark>
              <span>
                <span className="sr-only">{t("play.print.slot", { number })}: </span>
                {node.role}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

/** A number in a circle drawn with its border, so it prints without backgrounds. */
function NumberMark({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-foreground text-xs font-[850]"
    >
      {children}
    </span>
  );
}

function SolutionSheets({
  scenario,
  slots,
  services,
}: {
  scenario: Scenario;
  slots: readonly PrintSlot[];
  services: ReadonlyMap<string, Service>;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section
      data-print-sheet="solutions"
      aria-labelledby={titleId}
      className="flex flex-col gap-8 break-before-page print:block"
    >
      <h2 id={titleId} className="break-after-avoid text-2xl font-bold print:mb-4">
        {t("play.print.solutionsTitle")}
      </h2>
      {slots.map((slot, index) => (
        <SlotSolution
          key={slot.node.id}
          slot={slot}
          scenario={scenario}
          services={services}
          // The first one shares its sheet with the heading of the solutions.
          sheet={index > 0}
        />
      ))}
    </section>
  );
}

function SlotSolution({
  slot: { node, number },
  scenario,
  services,
  sheet,
}: {
  slot: PrintSlot;
  scenario: Scenario;
  services: ReadonlyMap<string, Service>;
  sheet: boolean;
}) {
  const { t } = useTranslation();
  const titleId = useId();
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
    <article
      data-print-sheet={sheet ? "slot" : undefined}
      data-slot-number={number}
      aria-labelledby={titleId}
      className={cn(SHEET, !sheet && "break-before-auto")}
    >
      <h3 id={titleId} className="break-after-avoid text-xl font-bold">
        {t("play.print.slotTitle", { number, role: node.role.trim().replace(/\.+$/, "") })}
      </h3>
      <AnswerGroup title={t("play.print.optimal")}>
        {optimal.map((a) => answer(a.service))}
      </AnswerGroup>
      <AnswerGroup title={t("play.print.acceptable")}>
        {acceptable.map((a) => answer(a.service))}
      </AnswerGroup>
      <AnswerGroup title={t("play.print.incorrect")}>
        {node.incorrect.map((i) => answer(i.service))}
      </AnswerGroup>
    </article>
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
  const { t } = useTranslation();
  const evaluation = evaluatePlacement(node, serviceId);
  if (evaluation.source === "undeclared") return null;
  const objectives = objectiveStatuses(evaluation, scenario.objectives);
  const references = evaluation.source === "answer" ? evaluation.references : [];
  return (
    <li
      data-grade={evaluation.grade}
      className="break-inside-avoid rounded-md border p-4 print:rounded-none print:border-x-0 print:border-t-0 print:px-0"
    >
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <GradeBadge grade={evaluation.grade} />
        <strong className="text-base">{services.get(serviceId)?.name ?? serviceId}</strong>
      </p>
      {objectives.length > 0 && (
        <ul aria-label={t("play.print.objectives")} className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
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
        <strong>{t("play.print.why")}</strong> <InlineMarkdown text={evaluation.rationale} />
      </p>
      {references.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-semibold">{t("play.print.docs")}</p>
          <ul className="mt-1 flex flex-col gap-1">
            {references.map((url) => (
              <li key={url}>
                {/* The URL is the text: on paper a link is only what it says. */}
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary underline underline-offset-4 print:no-underline"
                >
                  {url}
                  <span className="sr-only"> {t("about.external")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
