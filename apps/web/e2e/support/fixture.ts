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
      // Level 0 names each card «<plainName> (<name>)» (RF-PAL-06).
      optimal: "Lugar del mundo (Región de AWS)",
      analogyLimit:
        "Una ciudad es un solo lugar; una región agrupa varias zonas de disponibilidad aisladas entre sí.",
    },
    kitchens: {
      number: 2,
      role: "Dos cocinas en edificios distintos de la misma ciudad, con luz propia cada una.",
      optimal: "Centro de datos aparte (Zona de disponibilidad)",
      analogyLimit:
        "Las cocinas se ven desde la calle; las zonas de disponibilidad no muestran su ubicación exacta.",
    },
    recipes: {
      number: 3,
      role: "El lugar donde se guardan las recetas y las fotos del menú.",
      optimal: "Almacenamiento de archivos (Amazon S3)",
      analogyLimit:
        "Un archivo de papel tiene carpetas; acá cada receta es un objeto con su clave, sin carpetas reales.",
    },
  },
  /**
   * Plain and real name of every catalog entry its palette can show (curated, up to 8): the
   * answers, the incorrect ones, `palette.extra` and their confusion groups.
   */
  names: {
    s3: ["Almacenamiento de archivos", "Amazon S3"],
    efs: ["Disco compartido", "Amazon EFS"],
    ec2: ["Computadora alquilada", "Amazon EC2"],
    region: ["Lugar del mundo", "Región de AWS"],
    "availability-zone": ["Centro de datos aparte", "Zona de disponibilidad"],
    "edge-location": ["Punto de entrega cercano", "Ubicación de borde"],
    "pay-as-you-go": ["Pagar solo lo que usás", "Pago por uso"],
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
