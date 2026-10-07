// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the specs know about the e2e fixture bundle (e2e/fixtures/content): titles, slot roles,
// service names and the numbers its game-rules.yaml gives. Texts are the ones the player reads.

/**
 * Level 100, three slots; `thumbnailer` has optimal, acceptable, incorrect and two hints, `index`
 * one hint and `store` none. `number` is the one the board and the summary give the slot: its
 * position among the slots of the diagram.
 */
export const CLUB_PHOTOS = {
  id: "club-photos",
  title: "Fotos de un club de barrio",
  slots: {
    store: {
      number: 1,
      role: "Almacenamiento durable donde quedan las fotos originales.",
      optimal: "Amazon S3",
      incorrect: "Amazon EFS",
    },
    thumbnailer: {
      number: 2,
      role: "Lógica breve que genera la miniatura cuando llega una foto.",
      optimal: "AWS Lambda",
      acceptable: "AWS Fargate",
      incorrect: "Amazon EC2",
      hints: [
        "Se ejecuta solo cuando llega una foto.",
        "No hay nada encendido mientras nadie sube fotos.",
      ],
    },
    index: {
      number: 3,
      role: "Tabla que registra qué miniatura corresponde a cada foto.",
      optimal: "Amazon DynamoDB",
      hints: ["Se consulta por clave y no tiene servidores que mantener."],
    },
  },
} as const;

/** Level 200: locked for a beginner until club-photos is completed. */
export const PHOTO_QUEUE = {
  id: "photo-queue",
  title: "Pedidos de impresión de fotos",
  slots: {
    buffer: { number: 1, role: "Guarda los pedidos hasta que se procesan.", optimal: "Amazon SQS" },
    worker: { number: 2, role: "Procesa cada pedido.", optimal: "AWS Lambda" },
  },
} as const;

/**
 * Level 0 (ADR-0027), area «fundamentos», three slots with only an optimal answer each: two
 * concepts and a service, all with a plain name. Its palette is curated: the three answers and
 * four distractors.
 */
export const PIZZERIA = {
  id: "pizzeria",
  title: "Una pizzería que abre en otra ciudad",
  slots: {
    city: {
      number: 1,
      role: "La ciudad donde la pizzería abre, elegida por estar cerca de sus clientes.",
      optimal: "Región de AWS",
    },
    kitchens: {
      number: 2,
      role: "Dos cocinas en edificios distintos de la misma ciudad, con luz propia cada una.",
      optimal: "Zona de disponibilidad",
    },
    recipes: {
      number: 3,
      role: "El lugar donde se guardan las recetas y las fotos del menú.",
      optimal: "Amazon S3",
    },
  },
} as const;

export const AREAS = {
  fundamentos: "Fundamentos de la nube",
  serverless: "Serverless",
  storage: "Almacenamiento",
} as const;

export const EXPERIENCE = {
  newcomer: "Recién empiezo con la nube",
  beginner: "Recién empiezo",
  "aws-user": "Uso AWS",
  architect: "Diseño arquitecturas",
  expert: "Experto",
} as const;

/** Ranks of the fixture game-rules.yaml: Constructor from 200 XP. */
export const RANKS = { first: "Aprendiz", second: "Constructor" } as const;
