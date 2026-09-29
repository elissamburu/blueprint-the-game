// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Development page (/_diagrama): the board of every scenario with sample slot states. The states
// come from a real game-engine session driven with the commands of ADR-0008, so this page does
// not decide grades either. Slots react to Enter/Space/click (selectSlot) and to the sample
// services dragged above the board (placeService): the wiring the game screen will use.
import { Diagram, type ServiceDragData, type ServiceLookup } from "@blueprint/diagram";
import { commands, slotNodes, type Command } from "@blueprint/game-engine";
import type { GameRules, Scenario } from "@blueprint/scenario-schema";
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { cn } from "@blueprint/ui/lib/utils";
import {
  DndContext,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeading, PageShell } from "../app/page";
import { useContentStore } from "../content/content-store";
import type { ContentBundle } from "../content/load-bundle";
import { Loading, RequireContent } from "../content/RequireContent";
import { createServiceLookup, slotViews } from "../features/play/board";
import { createSessionStore } from "../features/play/session-store";

/** Sample states: optimal, acceptable (selected, one hint used), incorrect, and a used hint. */
export const sampleCommands = (scenario: Scenario): Command[] => {
  const [first, second, third, fourth] = slotNodes(scenario);
  const out: Command[] = [];
  const firstAnswer = first?.answers[0];
  if (first !== undefined && firstAnswer !== undefined) {
    out.push(commands.placeService(first.id, firstAnswer.service));
  }
  if (second !== undefined) {
    // The last answer: acceptable when the slot has one.
    const answer = second.answers.at(-1);
    if (answer !== undefined) out.push(commands.placeService(second.id, answer.service));
    out.push(commands.useHint(second.id), commands.selectSlot(second.id));
  }
  const wrong = third?.incorrect[0];
  if (third !== undefined && wrong !== undefined) {
    out.push(commands.placeService(third.id, wrong.service));
  }
  if (fourth !== undefined) out.push(commands.useHint(fourth.id));
  return out;
};

export default function DiagramPlayground() {
  return (
    <PageShell>
      <PageHeading
        kicker="Desarrollo"
        title="Tablero de los escenarios"
        description="Estados de ejemplo generados con game-engine. Tab y Enter seleccionan un casillero; arrastrá un servicio de la lista sobre un casillero para colocarlo."
      />
      <RequireContent>{(bundle) => <Scenarios bundle={bundle} />}</RequireContent>
    </PageShell>
  );
}

function Scenarios({ bundle }: { bundle: ContentBundle }) {
  const loadScenario = useContentStore((s) => s.loadScenario);
  const [scenarios, setScenarios] = useState<Scenario[] | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all(bundle.index.scenarios.map((entry) => loadScenario(entry.id))).then(
      (lookups) => {
        if (!active) return;
        setScenarios(lookups.flatMap((l) => (l.status === "ready" ? [l.scenario] : [])));
      },
    );
    return () => {
      active = false;
    };
  }, [bundle, loadScenario]);
  const services = useMemo(() => createServiceLookup(bundle.catalog.services), [bundle]);

  if (scenarios === null) return <Loading label="Cargando escenarios…" />;
  return (
    <div className="flex flex-col gap-12">
      {scenarios.map((scenario) => (
        <ScenarioSample
          key={scenario.id}
          scenario={scenario}
          rules={bundle.rules}
          services={services}
        />
      ))}
    </div>
  );
}

function ScenarioSample({
  scenario,
  rules,
  services,
}: {
  scenario: Scenario;
  rules: GameRules;
  services: ServiceLookup;
}) {
  // One store per scenario: the three boards are independent sessions.
  const [useSession] = useState(() => {
    const store = createSessionStore();
    store.getState().start(scenario, rules);
    for (const command of sampleCommands(scenario)) store.getState().dispatch(command);
    return store;
  });
  const session = useSession((s) => s.session);
  const dispatch = useSession((s) => s.dispatch);
  const [lastEvent, setLastEvent] = useState("—");
  const slots = useMemo(() => (session === null ? {} : slotViews(session)), [session]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const draggable = useMemo(
    () => [
      ...new Set(
        slotNodes(scenario).flatMap((n) => [
          ...n.answers.map((a) => a.service),
          ...n.incorrect.map((i) => i.service),
        ]),
      ),
    ],
    [scenario],
  );

  const onSlotActivate = useCallback(
    (slotId: string) => {
      setLastEvent(`onSlotActivate(${slotId})`);
      const selected = useSession.getState().session?.selectedSlotId;
      dispatch(commands.selectSlot(selected === slotId ? null : slotId));
    },
    [dispatch, useSession],
  );
  const onServiceDrop = useCallback(
    (slotId: string, serviceId: string) => {
      setLastEvent(`onServiceDrop(${slotId}, ${serviceId})`);
      dispatch(commands.placeService(slotId, serviceId));
    },
    [dispatch],
  );

  const titleId = `${scenario.id}-title`;
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <h2 id={titleId} className="text-xl">
        {scenario.title} <code className="text-sm text-muted-foreground">{scenario.id}</code>
      </h2>
      <DndContext sensors={sensors} collisionDetection={pointerWithin}>
        <ul aria-label="Servicios para arrastrar" className="flex flex-wrap gap-2">
          {draggable.map((id) => (
            <li key={id}>
              <DraggableService serviceId={id} services={services} />
            </li>
          ))}
        </ul>
        <Diagram
          diagram={scenario.diagram}
          services={services}
          slots={slots}
          onSlotActivate={onSlotActivate}
          onServiceDrop={onServiceDrop}
          label={`Diagrama: ${scenario.title}`}
          className="h-[760px] overflow-hidden rounded-lg border bg-card"
        />
      </DndContext>
      <p className="text-sm text-muted-foreground">
        Último evento: <code>{lastEvent}</code>
      </p>
    </section>
  );
}

/** Pointer-only sample drag source: the real palette (RF-PAL) has its own keyboard path. */
function DraggableService({ serviceId, services }: { serviceId: string; services: ServiceLookup }) {
  const data: ServiceDragData = { type: "service", serviceId };
  const { listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `service:${serviceId}`,
    data,
  });
  const service = services(serviceId);
  const name = service?.name ?? serviceId;
  return (
    <span
      ref={setNodeRef}
      {...listeners}
      style={
        transform === null
          ? undefined
          : { transform: `translate(${transform.x}px, ${transform.y}px)` }
      }
      className={cn(
        "relative flex cursor-grab touch-none items-center gap-2 rounded-md border bg-card px-2 py-1 text-xs",
        isDragging && "z-50 cursor-grabbing shadow-lg",
      )}
    >
      <ServiceIcon
        src={service?.iconSrc}
        name={name}
        category={service?.category ?? ""}
        decorative
        className="size-6"
      />
      {name}
    </span>
  );
}
