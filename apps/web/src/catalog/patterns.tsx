// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Game patterns translated from the Lovable prototype (src/components/blueprint-app.tsx and
// src/styles.css) to Tailwind utilities. They are visual samples with made-up data: the real
// screens and the slot of packages/diagram come in later PRs and take their data from
// game-engine and the content.
import { useId, useState } from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  CircleHelpIcon,
  CloudIcon,
  LightbulbIcon,
  LockIcon,
  TrophyIcon,
  XIcon,
} from "lucide-react";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import { ArchitectureSlot } from "@blueprint/ui/components/architecture-slot";
import type { SlotGrade } from "@blueprint/ui/components/grade-badge";
import { LevelBadge, type ScenarioLevel } from "@blueprint/ui/components/level-badge";
import { ObjectiveTag } from "@blueprint/ui/components/objective-tag";
import { Popover, PopoverContent, PopoverTrigger } from "@blueprint/ui/components/popover";
import { Progress } from "@blueprint/ui/components/progress";
import { RadioCardItem } from "@blueprint/ui/components/radio-card";
import { RadioGroup } from "@blueprint/ui/components/radio-group";
import { Toggle } from "@blueprint/ui/components/toggle";
import { cn } from "@blueprint/ui/lib/utils";
import { serviceIconSrc } from "../service-icons";

const HINT_COST = 15;

// ---------------------------------------------------------------------------------------------
// Onboarding (Lovable: Onboarding, .setup-panel, .step-kicker, .chip-grid, .experience-list)

const AREAS = [
  "Serverless",
  "Redes",
  "Seguridad",
  "Datos y analítica",
  "Almacenamiento",
  "Integración",
  "Contenedores",
  "Inteligencia artificial",
];
// Names from RF-ONB-02; descriptions from the prototype.
const EXPERIENCES = [
  { id: "beginner", name: "Recién empiezo", detail: "Quiero conocer los conceptos" },
  { id: "aws-user", name: "Uso AWS", detail: "Ya desplegué algunos proyectos" },
  { id: "architect", name: "Diseño arquitecturas", detail: "Tomo decisiones técnicas" },
  { id: "expert", name: "Experto", detail: "Optimizo sistemas complejos" },
];

export function OnboardingPanel() {
  const titleId = useId();
  const experienceLegendId = useId();
  const [areas, setAreas] = useState<ReadonlySet<string>>(new Set(["Serverless", "Redes"]));
  const [experience, setExperience] = useState("aws-user");
  const toggleArea = (area: string, pressed: boolean) =>
    setAreas((current) => {
      const next = new Set(current);
      if (pressed) next.add(area);
      else next.delete(area);
      return next;
    });

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border bg-card p-[clamp(1.5rem,3vw,2.7rem)] shadow-[0_22px_65px_color-mix(in_oklab,var(--foreground)_9%,transparent)]"
    >
      <div className="text-[0.68rem] font-extrabold tracking-[0.14em] text-primary uppercase">
        Configuración inicial · 1 de 2
      </div>
      <h2 id={titleId} className="mt-[0.65rem] text-[1.8rem]">
        Armemos tu ruta de aprendizaje
      </h2>
      <p className="mt-[0.6rem] leading-[1.6] text-muted-foreground">
        Elegí todo lo que te interese. Después podés cambiarlo desde tu perfil.
      </p>
      <fieldset className="mt-[1.8rem]">
        <legend className="mb-[0.8rem] font-[750]">¿Qué áreas querés practicar?</legend>
        <div className="flex flex-wrap gap-[0.55rem]">
          {AREAS.map((area) => {
            const pressed = areas.has(area);
            return (
              <Toggle
                key={area}
                variant="chip"
                pressed={pressed}
                onPressedChange={(next) => toggleArea(area, next)}
              >
                {pressed && <CheckIcon aria-hidden="true" />}
                {area}
              </Toggle>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="mt-[1.8rem]">
        <legend id={experienceLegendId} className="mb-[0.8rem] font-[750]">
          ¿Cuál es tu experiencia?
        </legend>
        <RadioGroup
          aria-labelledby={experienceLegendId}
          value={experience}
          onValueChange={setExperience}
          className="grid-cols-2 gap-[0.6rem] max-[700px]:grid-cols-1"
        >
          {EXPERIENCES.map((option, index) => (
            <RadioCardItem
              key={option.id}
              value={option.id}
              marker={index + 1}
              title={option.name}
              description={option.detail}
            />
          ))}
        </RadioGroup>
      </fieldset>
      <Button size="lg" className="mt-[1.8rem] w-full" disabled={areas.size === 0}>
        Ver mi ruta <ArrowRightIcon />
      </Button>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------
// Scenario card (Lovable: Scenarios, .scenario-card, .scenario-top, .scenario-icon, .area-row,
// .scenario-footer, .best-score)

type SampleScenario = {
  level: ScenarioLevel;
  title: string;
  summary: string;
  areas: string[];
  minutes: number;
  state: "in-progress" | "new" | "locked";
  bestScore?: number;
};

const SCENARIOS: SampleScenario[] = [
  {
    level: 100,
    title: "Sitio web estático con dominio propio y HTTPS",
    summary: "Publicá contenido global, seguro y sin servidores que mantener.",
    areas: ["Redes", "Almacenamiento"],
    minutes: 8,
    state: "in-progress",
    bestScore: 820,
  },
  {
    level: 200,
    title: "Comprobantes en PDF para un estudio contable",
    summary: "Procesá comprobantes por eventos, absorbé picos y pagá solo cuando hay trabajo.",
    areas: ["Serverless", "Almacenamiento", "Integración"],
    minutes: 18,
    state: "new",
  },
  {
    level: 400,
    title: "Plataforma crítica activa en múltiples regiones",
    summary: "Diseñá continuidad global, replicación y recuperación ante fallas regionales.",
    areas: ["Redes", "Seguridad"],
    minutes: 35,
    state: "locked",
  },
];

/**
 * Accessibility change: Lovable dims the whole locked card to 64 % opacity, which drops its
 * texts below 4.5:1. Here the locked card keeps the muted background, the lock and the disabled
 * button, but its texts keep their contrast.
 */
function ScenarioCard({ scenario }: { scenario: SampleScenario }) {
  const locked = scenario.state === "locked";
  return (
    <article
      className={cn(
        "flex min-h-[340px] flex-col rounded-lg border bg-card p-[1.3rem] transition-[transform,box-shadow] duration-200",
        locked
          ? "bg-muted"
          : "hover:-translate-y-[3px] hover:shadow-[0_15px_35px_color-mix(in_oklab,var(--foreground)_8%,transparent)]",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <LevelBadge level={scenario.level} />
        {locked ? (
          <LockIcon aria-label="Bloqueado" className="size-[17px] text-muted-foreground" />
        ) : scenario.bestScore !== undefined ? (
          <span className="flex items-center gap-[0.3rem] text-[0.75rem] font-extrabold text-warning">
            <TrophyIcon aria-hidden="true" className="size-[17px]" />
            <span className="sr-only">Mejor puntaje:</span> {scenario.bestScore}
          </span>
        ) : (
          <Badge variant="secondary" className="uppercase">
            Nuevo
          </Badge>
        )}
      </div>
      <div className="mt-[1.3rem] grid size-[42px] place-items-center rounded-[7px] bg-blueprint-soft text-primary">
        <CloudIcon aria-hidden="true" />
      </div>
      <h3 className="mt-[0.8rem] text-[1.12rem] leading-[1.35]">{scenario.title}</h3>
      <p className="mt-[0.55rem] text-[0.83rem] leading-[1.55] text-muted-foreground">
        {scenario.summary}
      </p>
      <div className="mt-4 flex flex-wrap gap-[0.4rem]">
        {scenario.areas.map((area) => (
          <Badge key={area} variant="secondary">
            {area}
          </Badge>
        ))}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t pt-4 text-[0.75rem] text-muted-foreground">
        <span>{scenario.minutes} min</span>
        <Button variant={locked ? "secondary" : "outline"} disabled={locked}>
          {locked
            ? "Completá nivel anterior"
            : scenario.state === "in-progress"
              ? "Continuar"
              : "Jugar"}
          {!locked && <ArrowRightIcon />}
        </Button>
      </div>
    </article>
  );
}

export function ScenarioCards() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {SCENARIOS.map((scenario) => (
        <ScenarioCard key={scenario.title} scenario={scenario} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Slot (Lovable: ArchitectureSlot, .architecture-slot inside .diagram-node-wrap, .slot-status,
// .placed-service, .empty-slot, .slot-main-action > p, .architecture-slot > button,
// .hint-popover) and board background (.architecture-board)

/** `id` and `category` are catalog ids: the icon comes from pnpm icons:fetch (ADR-0012). */
type SampleService = { id: string; name: string; category: string };

type SampleSlot = {
  grade: SlotGrade;
  role: string;
  service?: SampleService;
  hints: string[];
  hintsUsed: number;
};

export const SAMPLE_SLOTS: SampleSlot[] = [
  {
    grade: "optimal",
    role: "Entrada HTTPS",
    service: { id: "apigateway", name: "API Gateway", category: "networking-content-delivery" },
    hints: ["Buscá un servicio administrado que exponga una API HTTPS."],
    hintsUsed: 0,
  },
  {
    grade: "acceptable",
    role: "Buffer de avisos con reintentos",
    service: { id: "eventbridge", name: "EventBridge", category: "application-integration" },
    hints: [
      "Buscá un servicio que retenga mensajes hasta que se procesen.",
      "Pensá en una cola, no en un bus de eventos.",
    ],
    hintsUsed: 1,
  },
  {
    grade: "incorrect",
    role: "Lógica que genera URL temporal",
    service: { id: "ec2", name: "EC2", category: "compute" },
    hints: ["La restricción pide no administrar servidores."],
    hintsUsed: 0,
  },
  {
    grade: "empty",
    role: "Almacenamiento del PDF",
    hints: ["Buscá almacenamiento de objetos, no de archivos ni de bloques."],
    hintsUsed: 0,
  },
];

function HintPopoverContent({ slot, onClose }: { slot: SampleSlot; onClose: () => void }) {
  const headingId = useId();
  const used = Math.max(slot.hintsUsed, 1);
  return (
    <PopoverContent
      aria-labelledby={headingId}
      side="right"
      align="start"
      sideOffset={10}
      className="w-[300px] border-warning bg-card p-[0.8rem]"
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-[0.45rem] text-warning">
        <LightbulbIcon aria-hidden="true" className="size-[18px]" />
        <strong id={headingId} className="text-[0.7rem] text-foreground">
          Pistas · {slot.role}
        </strong>
        <Button
          variant="ghost"
          size="icon"
          className="size-[26px]"
          onClick={onClose}
          aria-label="Cerrar pistas"
        >
          <XIcon />
        </Button>
      </div>
      <ol aria-live="polite" className="my-[0.6rem] grid list-none gap-2 p-0">
        {slot.hints.slice(0, used).map((hint, index) => (
          <li
            key={hint}
            className="grid grid-cols-[19px_1fr] items-start gap-[0.45rem] text-[0.68rem] leading-[1.45] text-muted-foreground"
          >
            <span className="grid size-[19px] place-items-center rounded-full bg-warning-soft text-[0.58rem] font-[850] text-warning">
              {index + 1}
            </span>
            {hint}
          </li>
        ))}
      </ol>
      {used < slot.hints.length && (
        <Button variant="outline" size="sm" className="w-full">
          Ver otra pista (−{HINT_COST} pts)
        </Button>
      )}
    </PopoverContent>
  );
}

export function SlotSample({ slot }: { slot: SampleSlot }) {
  const [hintOpen, setHintOpen] = useState(false);
  const [selected, setSelected] = useState(false);
  const noMoreHints = slot.hintsUsed >= slot.hints.length;
  return (
    <ArchitectureSlot
      grade={slot.grade}
      role={slot.role}
      service={
        slot.service && {
          name: slot.service.name,
          category: slot.service.category,
          iconSrc: serviceIconSrc(slot.service.id),
        }
      }
      selected={selected}
      onActivate={() => setSelected((current) => !current)}
      className="size-[160px]"
      hintAction={
        slot.grade !== "optimal" && (
          <Popover open={hintOpen} onOpenChange={setHintOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={noMoreHints}
                aria-label={
                  noMoreHints
                    ? `Sin más pistas para ${slot.role}`
                    : `Ver pista para ${slot.role}, cuesta ${HINT_COST} puntos`
                }
                // Lovable: h-[25px] on one line, which overflows the node (docs/design/README.md,
                // problem 8). Here "Pistas n/m" stays on the "Ver pista" line when it fits and moves to a
                // second line only when it does not; neither text breaks inside. In the 160px slot the
                // row needs about 141px of the 140px available, so it wraps: NODE_SIZE.slot reserves it.
                // Hover underlines instead of painting the ghost background: over --accent the orange
                // counter drops to 4.32:1.
                className="mt-auto h-auto min-h-[25px] flex-wrap justify-start gap-x-2 gap-y-0 p-0 text-left text-[0.55rem] hover:bg-transparent hover:underline"
              >
                <CircleHelpIcon />
                <span>{noMoreHints ? "Sin más pistas" : `Ver pista (−${HINT_COST} pts)`}</span>
                <span className="ml-auto text-warning">
                  Pistas {slot.hintsUsed}/{slot.hints.length}
                </span>
              </Button>
            </PopoverTrigger>
            <HintPopoverContent slot={slot} onClose={() => setHintOpen(false)} />
          </Popover>
        )
      }
    />
  );
}

/** Lovable: .architecture-board (dotted canvas). */
export function SlotBoard() {
  return (
    <div className="flex flex-wrap gap-6 rounded-md border bg-canvas bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-[size:18px_18px] p-6">
      {SAMPLE_SLOTS.map((slot) => (
        <SlotSample key={slot.grade} slot={slot} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Feedback objectives (Lovable: FeedbackPanel, .feedback-panel, .goal-links)

export function FeedbackObjectives() {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-t-[3px] border-warning bg-warning-soft px-[1.2rem] py-4">
        <div className="flex flex-wrap gap-4">
          <ObjectiveTag status="met">Tráfico esporádico</ObjectiveTag>
          <ObjectiveTag status="partial">Ningún comprobante se pierde</ObjectiveTag>
        </div>
      </div>
      <div className="border-t-[3px] border-destructive bg-danger-soft px-[1.2rem] py-4">
        <div className="flex flex-wrap gap-4">
          <ObjectiveTag status="violated">Sin servidores</ObjectiveTag>
        </div>
      </div>
      <div className="border-t-[3px] border-success bg-success-soft px-[1.2rem] py-4">
        <div className="flex flex-wrap gap-4">
          <ObjectiveTag status="met">Costo mínimo en inactividad</ObjectiveTag>
          <ObjectiveTag status="met">Sin servidores</ObjectiveTag>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Game top bar pieces (Lovable: .game-topbar, .scenario-title, .game-progress)

export function GameTopBarSample() {
  const placed = 2;
  const total = 7;
  return (
    <div className="flex h-[72px] items-center gap-4 border-b bg-card px-[1.2rem]">
      <div className="flex min-w-0 items-center gap-[0.7rem]">
        <LevelBadge level={200} variant="solid" />
        <div className="min-w-0">
          <strong className="block">Comprobantes en PDF para un estudio contable</strong>
          <span className="mt-[0.12rem] block text-[0.72rem] text-muted-foreground">
            Serverless · Almacenamiento · Integración
          </span>
        </div>
      </div>
      <div className="ml-auto grid grid-cols-[auto_130px] items-center gap-[0.6rem] text-[0.72rem] text-muted-foreground">
        <span>
          {placed} de {total} casilleros
        </span>
        <Progress value={(placed / total) * 100} aria-label={`${placed} de ${total} casilleros`} />
      </div>
    </div>
  );
}
