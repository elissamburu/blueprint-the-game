// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Referencia" section: each game pattern next to a crop of the matching screenshot of
// docs/design/pantallas/, to compare by eye. Crops are in pixels of the original screenshot.
import type * as React from "react";
import onboarding from "../../../../docs/design/pantallas/00-onboarding.png";
import scenarioList from "../../../../docs/design/pantallas/03-escenarios-listado.png";
import gameIncorrect from "../../../../docs/design/pantallas/06-juego-incorrecto.png";
import gameAcceptable from "../../../../docs/design/pantallas/07-juego-aceptable.png";
import gameHints from "../../../../docs/design/pantallas/08-juego-pistas.png";
import {
  FeedbackObjectives,
  GameTopBarSample,
  OnboardingPanel,
  ScenarioCards,
  SlotBoard,
} from "./patterns";

type Shot = {
  src: string;
  file: string;
  /** Natural size of the screenshot. */
  width: number;
  height: number;
  crop: { x: number; y: number; w: number; h: number };
  alt: string;
};

const SHOTS = {
  onboarding: {
    src: onboarding,
    file: "00-onboarding.png",
    width: 1565,
    height: 829,
    crop: { x: 898, y: 110, w: 586, h: 708 },
    alt: "Panel de configuración inicial: chips de áreas y tarjetas de experiencia",
  },
  scenarioCards: {
    src: scenarioList,
    file: "03-escenarios-listado.png",
    width: 1252,
    height: 796,
    crop: { x: 95, y: 70, w: 1150, h: 715 },
    alt: "Tarjetas de escenario de niveles 100 a 400, una bloqueada",
  },
  slotsAcceptable: {
    src: gameAcceptable,
    file: "07-juego-aceptable.png",
    width: 1897,
    height: 834,
    crop: { x: 590, y: 280, w: 740, h: 195 },
    alt: "Casilleros óptimo, aceptable y vacíos sobre el tablero",
  },
  slotIncorrect: {
    src: gameIncorrect,
    file: "06-juego-incorrecto.png",
    width: 1881,
    height: 853,
    crop: { x: 760, y: 266, w: 180, h: 185 },
    alt: "Casillero incorrecto con EC2",
  },
  hints: {
    src: gameHints,
    file: "08-juego-pistas.png",
    width: 493,
    height: 275,
    crop: { x: 0, y: 0, w: 493, h: 275 },
    alt: "Popover de pistas de un casillero",
  },
  feedbackAcceptable: {
    src: gameAcceptable,
    file: "07-juego-aceptable.png",
    width: 1897,
    height: 834,
    crop: { x: 240, y: 676, w: 660, h: 158 },
    alt: "Panel de feedback aceptable con un objetivo a medias",
  },
  feedbackIncorrect: {
    src: gameIncorrect,
    file: "06-juego-incorrecto.png",
    width: 1881,
    height: 853,
    crop: { x: 240, y: 684, w: 660, h: 165 },
    alt: "Panel de feedback incorrecto con una restricción violada",
  },
  topBar: {
    src: gameIncorrect,
    file: "06-juego-incorrecto.png",
    width: 1881,
    height: 853,
    crop: { x: 20, y: 70, w: 1860, h: 70 },
    alt: "Barra superior del juego con nivel, título, progreso y puntaje",
  },
} satisfies Record<string, Shot>;

function ReferenceShot({ shot }: { shot: Shot }) {
  const { crop } = shot;
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="relative w-full overflow-hidden rounded-md border bg-card"
        // At most the natural size of the crop, so it is never upscaled.
        style={{ aspectRatio: `${crop.w} / ${crop.h}`, maxWidth: crop.w }}
      >
        <img
          src={shot.src}
          alt={shot.alt}
          className="absolute max-w-none"
          style={{
            width: `${(shot.width / crop.w) * 100}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
          }}
        />
      </div>
      <figcaption className="text-[0.72rem] text-muted-foreground">
        docs/design/pantallas/{shot.file} ·{" "}
        <a href={shot.src} target="_blank" rel="noreferrer" className="text-primary underline">
          captura completa
        </a>
      </figcaption>
    </figure>
  );
}

function Pair({
  title,
  lovable,
  children,
  shots,
  stacked = false,
}: {
  title: string;
  /** Lovable selectors or components this pattern translates. */
  lovable: string;
  children: React.ReactNode;
  shots: Shot[];
  stacked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-[1.4rem]">
      <div>
        <h3 className="section-kicker">{title}</h3>
        <p className="mt-1 text-[0.72rem] text-muted-foreground">Lovable: {lovable}</p>
      </div>
      <div className={stacked ? "flex flex-col gap-4" : "grid items-start gap-6 lg:grid-cols-2"}>
        <div className="min-w-0">{children}</div>
        <div className="flex min-w-0 flex-col gap-4">
          {shots.map((shot) => (
            <ReferenceShot key={`${shot.file}-${shot.crop.x}-${shot.crop.y}`} shot={shot} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ReferencePairs() {
  return (
    <div className="flex flex-col gap-4">
      <Pair
        title="Onboarding: áreas y experiencia"
        lovable="Onboarding, .setup-panel, .chip-grid, .experience-option, .level-number, .radio-dot"
        shots={[SHOTS.onboarding]}
      >
        <OnboardingPanel />
      </Pair>
      <Pair
        title="Casillero en sus cuatro estados y popover de pistas"
        lovable="ArchitectureSlot, .architecture-slot, .slot-status, .placed-service, .empty-slot, .hint-popover"
        shots={[SHOTS.slotsAcceptable, SHOTS.slotIncorrect, SHOTS.hints]}
      >
        <SlotBoard />
        <p className="mt-3 text-[0.72rem] text-muted-foreground">
          Abrí “Ver pista” en el casillero aceptable para ver el popover.
        </p>
      </Pair>
      <Pair
        title="Objetivos en el feedback"
        lovable="FeedbackPanel, .feedback-panel, .goal-links"
        shots={[SHOTS.feedbackAcceptable, SHOTS.feedbackIncorrect]}
      >
        <FeedbackObjectives />
      </Pair>
      <Pair
        title="Barra del juego: nivel y progreso"
        lovable="GameScreen, .game-topbar, .scenario-title, .game-progress"
        shots={[SHOTS.topBar]}
        stacked
      >
        <GameTopBarSample />
      </Pair>
      <Pair
        title="Tarjeta de escenario"
        lovable="Scenarios, .scenario-card, .scenario-top, .scenario-icon, .area-row, .scenario-footer"
        shots={[SHOTS.scenarioCards]}
        stacked
      >
        <ScenarioCards />
      </Pair>
    </div>
  );
}
