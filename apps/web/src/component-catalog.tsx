// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Development page: every @blueprint/ui component with its variants and states. The texts are
// sample data; the game screens (router, i18n, content loading) arrive in a later PR.
import type * as React from "react";
import { useState } from "react";
import { ArrowRightIcon, CircleHelpIcon, InfoIcon, PlayIcon } from "lucide-react";
import { Badge } from "@blueprint/ui/components/badge";
import { Button } from "@blueprint/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@blueprint/ui/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@blueprint/ui/components/dialog";
import { GradeBadge, type SlotGrade } from "@blueprint/ui/components/grade-badge";
import { LevelBadge, type ScenarioLevel } from "@blueprint/ui/components/level-badge";
import { ObjectiveTag } from "@blueprint/ui/components/objective-tag";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@blueprint/ui/components/popover";
import { Progress } from "@blueprint/ui/components/progress";
import { RadioGroup, RadioGroupItem } from "@blueprint/ui/components/radio-group";
import { ScrollArea } from "@blueprint/ui/components/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@blueprint/ui/components/select";
import { Separator } from "@blueprint/ui/components/separator";
import { Toaster, toast } from "@blueprint/ui/components/sonner";
import { Toggle } from "@blueprint/ui/components/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@blueprint/ui/components/tooltip";

const GRADES: readonly SlotGrade[] = ["optimal", "acceptable", "incorrect", "empty"];
const LEVELS: readonly ScenarioLevel[] = [100, 200, 300, 400];
const BUTTON_VARIANTS = [
  "default",
  "secondary",
  "outline",
  "ghost",
  "link",
  "destructive",
] as const;
const BUTTON_SIZES = ["xs", "sm", "default", "lg"] as const;
const BADGE_VARIANTS = ["default", "secondary", "outline", "destructive"] as const;
const EXPERIENCES = [
  { id: "beginner", label: "Recién empiezo" },
  { id: "aws-user", label: "Uso AWS" },
  { id: "architect", label: "Diseño arquitecturas" },
  { id: "expert", label: "Experto" },
] as const;
const AREAS = ["Serverless", "Cómputo", "Almacenamiento", "Redes", "Integración", "Seguridad"];
const SERVICES = [
  "Amazon API Gateway",
  "AWS Lambda",
  "Amazon S3",
  "Amazon DynamoDB",
  "Amazon SQS",
  "Amazon SNS",
  "Amazon EventBridge",
  "AWS Step Functions",
  "Amazon CloudFront",
  "Amazon Route 53",
  "Elastic Load Balancing",
  "Amazon EC2",
];

export function ComponentCatalog() {
  return (
    <TooltipProvider>
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
        <header className="flex flex-col gap-2">
          <p className="text-primary text-xs font-extrabold tracking-[0.12em] uppercase">
            Desarrollo · @blueprint/ui
          </p>
          <h1 className="text-3xl font-bold">Catálogo de componentes</h1>
          <p className="text-muted-foreground max-w-2xl">
            Todos los componentes compartidos con sus variantes y estados. Los textos son de
            ejemplo.
          </p>
        </header>

        <main className="flex flex-col gap-10">
          <GameComponents />
          <Buttons />
          <BadgesAndCards />
          <Overlays />
          <FormControls />
          <Layout />
        </main>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <div>
        <h2 id={id} className="text-xl font-bold">
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Demo({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card flex flex-col gap-3 rounded-lg border p-5">
      <h3 className="text-muted-foreground text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function GameComponents() {
  return (
    <Section
      id="game"
      title="Propios del juego"
      description="Reciben el estado por props: no deciden grados ni evalúan nada."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Demo title="GradeBadge">
          <ul className="flex flex-col gap-2">
            {GRADES.map((grade) => (
              <li key={grade} className="flex items-center gap-4">
                <GradeBadge grade={grade} />
                <GradeBadge grade={grade} variant="soft" />
              </li>
            ))}
          </ul>
        </Demo>
        <Demo title="ObjectiveTag">
          <ul className="flex flex-col gap-2">
            <li>
              <ObjectiveTag status="met">Tráfico esporádico</ObjectiveTag>
            </li>
            <li>
              <ObjectiveTag status="partial">Ningún comprobante se pierde</ObjectiveTag>
            </li>
            <li>
              <ObjectiveTag status="violated">Sin servidores</ObjectiveTag>
            </li>
          </ul>
        </Demo>
        <Demo title="LevelBadge">
          <ul className="flex flex-col gap-2">
            {LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-3">
                <LevelBadge level={level} variant="solid" />
                <LevelBadge level={level} />
              </li>
            ))}
          </ul>
        </Demo>
      </div>
      <Demo title="Estados del casillero (fondo suave + borde por grado)">
        <div className="bg-canvas grid gap-3 rounded-md p-4 sm:grid-cols-2 lg:grid-cols-4">
          <SlotPreview grade="optimal" service="API Gateway" role="Entrada HTTPS" />
          <SlotPreview grade="acceptable" service="EventBridge" role="Buffer de avisos" />
          <SlotPreview grade="incorrect" service="EC2" role="Lógica que genera URL temporal" />
          <SlotPreview grade="empty" role="Procesador" />
        </div>
      </Demo>
    </Section>
  );
}

const SLOT_STYLES: Record<SlotGrade, string> = {
  optimal: "border-success bg-success-soft",
  acceptable: "border-warning bg-warning-soft",
  incorrect: "border-destructive bg-danger-soft",
  empty: "border-dashed border-slot-border bg-card",
};

/** Visual sample only: the real slot lives in packages/diagram. */
function SlotPreview({
  grade,
  service,
  role,
}: {
  grade: SlotGrade;
  service?: string;
  role: string;
}) {
  return (
    <div className={`flex flex-col gap-2 rounded-md border-2 p-3 ${SLOT_STYLES[grade]}`}>
      <GradeBadge grade={grade} />
      <div className="bg-card rounded-md border px-3 py-2 text-sm font-semibold">
        {service ?? <span className="text-muted-foreground font-normal">Elegí un servicio</span>}
      </div>
      <p className="text-muted-foreground text-xs">{role}</p>
    </div>
  );
}

function Buttons() {
  return (
    <Section id="button" title="Button" description="Variantes, tamaños, ícono y deshabilitado.">
      <Demo title="Variantes">
        <div className="flex flex-wrap items-center gap-3">
          {BUTTON_VARIANTS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
        </div>
      </Demo>
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Tamaños">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} size={size} variant="outline">
                {size}
              </Button>
            ))}
            <Button size="icon" variant="outline" aria-label="Reproducir flujo">
              <PlayIcon />
            </Button>
          </div>
        </Demo>
        <Demo title="Con ícono y deshabilitado">
          <div className="flex flex-wrap items-center gap-3">
            <Button>
              Jugar <ArrowRightIcon />
            </Button>
            <Button variant="outline">
              <PlayIcon /> Reproducir flujo
            </Button>
            <Button disabled>Deshabilitado</Button>
            <Button variant="outline" disabled>
              Completá nivel anterior
            </Button>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

function BadgesAndCards() {
  return (
    <Section id="badge-card" title="Badge y Card" description="Etiquetas y tarjetas.">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            {BADGE_VARIANTS.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
            <Badge variant="secondary">Almacenamiento</Badge>
          </div>
        </Demo>
        <Card>
          <CardHeader>
            <CardTitle>Sitio web estático con dominio propio y HTTPS</CardTitle>
            <CardDescription>Publicá contenido global, seguro y sin servidores.</CardDescription>
            <CardAction>
              <LevelBadge level={100} />
            </CardAction>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Badge variant="secondary">Redes</Badge>
            <Badge variant="secondary">Almacenamiento</Badge>
          </CardContent>
          <CardFooter className="justify-between">
            <span className="text-muted-foreground text-sm">8 min</span>
            <Button variant="outline">
              Jugar <ArrowRightIcon />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </Section>
  );
}

function Overlays() {
  return (
    <Section
      id="overlays"
      title="Popover, Tooltip, Dialog y Sonner"
      description="Capas flotantes: abrilas con mouse o teclado."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <Demo title="Popover">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CircleHelpIcon /> Ver pista (−15 pts)
              </Button>
            </PopoverTrigger>
            <PopoverContent aria-labelledby="hint-title">
              <PopoverHeader>
                <PopoverTitle id="hint-title">Pista 1 de 2</PopoverTitle>
                <PopoverDescription>
                  Buscá un servicio que absorba picos sin perder mensajes.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
        </Demo>
        <Demo title="Tooltip">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Qué es un casillero">
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Un lugar del diagrama donde va un servicio</TooltipContent>
          </Tooltip>
        </Demo>
        <Demo title="Dialog">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">Finalizar</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>¿Finalizar el escenario?</DialogTitle>
                <DialogDescription>
                  Quedan 5 casilleros vacíos. Se puntúan como incorrectos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Seguir jugando</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button>Finalizar</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Demo>
        <Demo title="Sonner (toasts)">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => toast("Progreso guardado")}>
              Normal
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.success("¡Subiste a Arquitecto!")}
            >
              Éxito
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => toast.warning("Usaste todas las pistas")}
            >
              Aviso
            </Button>
            <Button size="sm" variant="outline" onClick={() => toast.error("No se pudo guardar")}>
              Error
            </Button>
          </div>
        </Demo>
      </div>
    </Section>
  );
}

function FormControls() {
  const [experience, setExperience] = useState<string>("aws-user");
  const [areas, setAreas] = useState<ReadonlySet<string>>(new Set(["Serverless"]));
  const toggleArea = (area: string, pressed: boolean) =>
    setAreas((current) => {
      const next = new Set(current);
      if (pressed) next.add(area);
      else next.delete(area);
      return next;
    });

  return (
    <Section
      id="controls"
      title="RadioGroup, Toggle, Select y Progress"
      description="Controles del onboarding, filtros y avance."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="RadioGroup (experiencia)">
          <RadioGroup
            value={experience}
            onValueChange={setExperience}
            aria-label="Experiencia con AWS"
          >
            {EXPERIENCES.map(({ id, label }) => (
              <div key={id} className="flex items-center gap-3">
                <RadioGroupItem value={id} id={`experience-${id}`} />
                <label htmlFor={`experience-${id}`} className="text-sm">
                  {label}
                </label>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <RadioGroupItem value="disabled" id="experience-disabled" disabled />
              <label htmlFor="experience-disabled" className="text-muted-foreground text-sm">
                Deshabilitada
              </label>
            </div>
          </RadioGroup>
        </Demo>
        <Demo title="Toggle (áreas de interés, aria-pressed)">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Áreas de interés">
            {AREAS.map((area) => (
              <Toggle
                key={area}
                variant="outline"
                pressed={areas.has(area)}
                onPressedChange={(pressed) => toggleArea(area, pressed)}
              >
                {area}
              </Toggle>
            ))}
            <Toggle variant="outline" disabled>
              Deshabilitado
            </Toggle>
          </div>
        </Demo>
        <Demo title="Select">
          <div className="flex items-center gap-3">
            <label htmlFor="level-filter" className="text-muted-foreground text-sm">
              Nivel
            </label>
            <Select defaultValue="all">
              <SelectTrigger id="level-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {LEVELS.map((level) => (
                  <SelectItem key={level} value={String(level)}>
                    Nivel {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Demo>
        <Demo title="Progress">
          <div className="flex flex-col gap-3">
            {[0, 2, 7].map((placed) => (
              <div key={placed} className="flex items-center gap-3">
                <Progress
                  value={(placed / 7) * 100}
                  aria-label={`${placed} de 7 casilleros`}
                  className="flex-1"
                />
                <span className="text-muted-foreground w-28 text-sm">{placed} de 7 casilleros</span>
              </div>
            ))}
          </div>
        </Demo>
      </div>
    </Section>
  );
}

function Layout() {
  return (
    <Section id="layout" title="Separator y ScrollArea" description="Separadores y scroll interno.">
      <div className="grid gap-4 md:grid-cols-2">
        <Demo title="Separator">
          <div className="flex flex-col gap-3 text-sm">
            <span>Restricciones</span>
            <Separator />
            <div className="flex h-5 items-center gap-3">
              <span>Escenarios</span>
              <Separator orientation="vertical" />
              <span>Perfil</span>
              <Separator orientation="vertical" />
              <span>Acerca de</span>
            </div>
          </div>
        </Demo>
        <Demo title="ScrollArea (paleta)">
          <ScrollArea className="h-40 rounded-md border">
            <ul className="p-3 text-sm">
              {SERVICES.map((service) => (
                <li key={service} className="border-b py-2 last:border-b-0">
                  {service}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Demo>
      </div>
    </Section>
  );
}
