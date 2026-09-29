// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Development page: every @blueprint/ui component with its variants and states, and the game
// patterns next to the Lovable screenshots. The texts are sample data; the game screens (router,
// i18n, content loading) arrive in a later PR.
import { useId } from "react";
import { ArrowRightIcon, InfoIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@blueprint/ui/components/alert-dialog";
import { Badge } from "@blueprint/ui/components/badge";
import { Button, buttonVariants } from "@blueprint/ui/components/button";
import {
  Card,
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
import { ServiceIcon } from "@blueprint/ui/components/service-icon";
import { Toaster, toast } from "@blueprint/ui/components/sonner";
import { Toggle } from "@blueprint/ui/components/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@blueprint/ui/components/tooltip";
import { PageHeading, PageShell, Panel, Section } from "./catalog/layout";
import { ReferencePairs } from "./catalog/reference";
import { serviceIconSrc } from "./service-icons";

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
const BUTTON_SIZES = ["sm", "default", "lg"] as const;
const BADGE_VARIANTS = ["default", "secondary", "outline", "destructive"] as const;
/** Catalog ids and categories: the icons come from pnpm icons:fetch (ADR-0012). */
const SERVICES = [
  { id: "apigateway", name: "API Gateway", category: "networking-content-delivery" },
  { id: "lambda", name: "Lambda", category: "compute" },
  { id: "s3", name: "S3", category: "storage" },
  { id: "dynamodb", name: "DynamoDB", category: "databases" },
  { id: "sqs", name: "SQS", category: "application-integration" },
  { id: "sns", name: "SNS", category: "application-integration" },
  { id: "eventbridge", name: "EventBridge", category: "application-integration" },
  { id: "step-functions", name: "Step Functions", category: "application-integration" },
  { id: "cloudfront", name: "CloudFront", category: "networking-content-delivery" },
  { id: "route53", name: "Route 53", category: "networking-content-delivery" },
  { id: "alb", name: "Application Load Balancer", category: "networking-content-delivery" },
  { id: "ec2", name: "EC2", category: "compute" },
  // Not in the catalog: always shows the fallback.
  { id: "sin-icono", name: "Servicio sin ícono", category: "security-identity" },
];

export function ComponentCatalog() {
  return (
    <TooltipProvider>
      <PageShell>
        <PageHeading
          kicker="Desarrollo · @blueprint/ui"
          title="Catálogo de componentes"
          description="Componentes compartidos con sus variantes y estados, y los patrones del juego al lado de las capturas de referencia. Los textos son de ejemplo."
        />
        <main>
          <Section
            id="reference"
            kicker="Patrones del juego"
            title="Referencia"
            description="Cada patrón al lado de su captura de docs/design/pantallas/."
          >
            <ReferencePairs />
          </Section>
          <OwnComponents />
          <Buttons />
          <BadgesAndCards />
          <Overlays />
          <FormControls />
          <Layout />
        </main>
      </PageShell>
      <Toaster />
    </TooltipProvider>
  );
}

function OwnComponents() {
  return (
    <Section
      id="own"
      kicker="Propios"
      title="GradeBadge, ObjectiveTag y LevelBadge"
      description="Reciben el estado por props: no deciden grados ni evalúan nada."
    >
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="GradeBadge">
          <ul className="flex flex-col gap-2">
            {GRADES.map((grade) => (
              <li key={grade}>
                <GradeBadge grade={grade} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="ObjectiveTag">
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
        </Panel>
        <Panel title="LevelBadge">
          <ul className="flex flex-col gap-2">
            {LEVELS.map((level) => (
              <li key={level} className="flex items-center gap-3">
                <LevelBadge level={level} variant="solid" />
                <LevelBadge level={level} />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </Section>
  );
}

function Buttons() {
  return (
    <Section
      id="button"
      kicker="shadcn/ui"
      title="Button"
      description="Variantes, tamaños, ícono y deshabilitado."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Variantes">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant}
              </Button>
            ))}
          </div>
        </Panel>
        <Panel title="Tamaños, ícono y deshabilitado">
          <div className="flex flex-wrap items-center gap-3">
            {BUTTON_SIZES.map((size) => (
              <Button key={size} size={size} variant="outline">
                {size}
              </Button>
            ))}
            <Button size="icon" variant="outline" aria-label="Reproducir flujo">
              <PlayIcon />
            </Button>
            <Button>
              Jugar <ArrowRightIcon />
            </Button>
            <Button disabled>Deshabilitado</Button>
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function BadgesAndCards() {
  return (
    <Section
      id="badge-card"
      kicker="shadcn/ui"
      title="Badge y Card"
      description="Etiquetas y tarjeta."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Badge">
          <div className="flex flex-wrap items-center gap-3">
            {BADGE_VARIANTS.map((variant) => (
              <Badge key={variant} variant={variant}>
                {variant}
              </Badge>
            ))}
          </div>
        </Panel>
        <Card>
          <CardHeader>
            <CardTitle>Card</CardTitle>
            <CardDescription>Tarjeta genérica, como card.tsx de Lovable.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">Contenido de la tarjeta.</CardContent>
          <CardFooter className="justify-end">
            <Button variant="outline">Acción</Button>
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
      kicker="shadcn/ui"
      title="Tooltip, Dialog, AlertDialog y Sonner"
      description="Capas flotantes: abrilas con mouse o teclado. El Popover está en el casillero."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Tooltip">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Qué es un casillero">
                <InfoIcon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Un lugar del diagrama donde va un servicio</TooltipContent>
          </Tooltip>
        </Panel>
        <Panel title="Dialog">
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
        </Panel>
        <Panel title="AlertDialog">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-destructive text-destructive hover:bg-danger-soft hover:text-destructive"
              >
                <RotateCcwIcon aria-hidden />
                Reiniciar progreso
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Reiniciar tu progreso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Vas a perder tu XP, tu rango, tus mejores resultados y los niveles desbloqueados.
                  No se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className={buttonVariants({ variant: "destructive" })}>
                  Sí, reiniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Panel>
        <Panel title="Sonner (toasts)">
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
        </Panel>
      </div>
    </Section>
  );
}

const MODES = [
  { id: "drag", label: "Arrastrar", disabled: false },
  { id: "tap", label: "Tocar y elegir", disabled: false },
  { id: "disabled", label: "Deshabilitado", disabled: true },
];

function FormControls() {
  const radioLabelId = useId();
  return (
    <Section
      id="controls"
      kicker="shadcn/ui"
      title="Toggle, RadioGroup, Select y Progress"
      description="Estados de cada control. Los patrones del onboarding están en Referencia."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Toggle">
          <div className="flex flex-wrap items-center gap-2">
            <Toggle>default</Toggle>
            <Toggle variant="outline">outline</Toggle>
            <Toggle variant="outline" defaultPressed>
              outline activo
            </Toggle>
            <Toggle variant="chip">chip</Toggle>
            <Toggle variant="chip" defaultPressed>
              chip activo
            </Toggle>
            <Toggle variant="chip" disabled>
              Deshabilitado
            </Toggle>
          </div>
        </Panel>
        <Panel title="RadioGroup">
          <span id={radioLabelId} className="sr-only">
            Modo de juego
          </span>
          <RadioGroup aria-labelledby={radioLabelId} defaultValue="drag">
            {MODES.map((mode) => (
              <div key={mode.id} className="flex items-center gap-3">
                <RadioGroupItem value={mode.id} id={`mode-${mode.id}`} disabled={mode.disabled} />
                <label htmlFor={`mode-${mode.id}`} className="text-sm">
                  {mode.label}
                </label>
              </div>
            ))}
          </RadioGroup>
        </Panel>
        <Panel title="Select (filtros del listado)">
          <div className="flex items-center gap-4">
            <label
              htmlFor="level-filter"
              className="flex items-center gap-[0.45rem] text-[0.78rem] text-muted-foreground"
            >
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
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Panel>
        <Panel title="Progress">
          <div className="flex flex-col gap-3">
            {[0, 2, 7].map((placed) => (
              <div
                key={placed}
                className="grid grid-cols-[auto_130px] items-center gap-[0.6rem] text-[0.72rem] text-muted-foreground"
              >
                <span className="w-28">{placed} de 7 casilleros</span>
                <Progress value={(placed / 7) * 100} aria-label={`${placed} de 7 casilleros`} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Section>
  );
}

function Layout() {
  return (
    <Section
      id="layout"
      kicker="shadcn/ui"
      title="Separator y ScrollArea"
      description="Separadores y scroll interno."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Separator">
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
        </Panel>
        <Panel title="ScrollArea (paleta, .service-card)">
          <ScrollArea className="h-48 rounded-md border">
            <ul className="grid gap-[0.4rem] p-[0.55rem]">
              {SERVICES.map((service) => (
                <li
                  key={service.id}
                  className="flex min-h-[46px] items-center gap-[0.55rem] rounded-md border bg-background p-[0.45rem] text-[0.68rem] font-bold"
                >
                  <ServiceIcon
                    src={serviceIconSrc(service.id)}
                    name={service.name}
                    category={service.category}
                    decorative
                    className="size-7 rounded-[4px]"
                  />
                  {service.name}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </Panel>
      </div>
    </Section>
  );
}
