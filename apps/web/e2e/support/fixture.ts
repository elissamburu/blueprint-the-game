// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What the specs know about the e2e fixture bundle (e2e/fixtures/content): titles, slot roles,
// service names and the numbers its game-rules.yaml gives. Texts are the ones the player reads.

/** Level 100, three slots; `thumbnailer` has optimal, acceptable, incorrect and two hints. */
export const CLUB_PHOTOS = {
  id: "club-photos",
  title: "Fotos de un club de barrio",
  slots: {
    store: {
      role: "Almacenamiento durable donde quedan las fotos originales.",
      optimal: "Amazon S3",
      incorrect: "Amazon EFS",
    },
    thumbnailer: {
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
      role: "Tabla que registra qué miniatura corresponde a cada foto.",
      optimal: "Amazon DynamoDB",
    },
  },
} as const;

/** Level 200: locked for a beginner until club-photos is completed. */
export const PHOTO_QUEUE = {
  id: "photo-queue",
  title: "Pedidos de impresión de fotos",
  slots: {
    buffer: { role: "Guarda los pedidos hasta que se procesan.", optimal: "Amazon SQS" },
    worker: { role: "Procesa cada pedido.", optimal: "AWS Lambda" },
  },
} as const;

export const AREAS = { serverless: "Serverless", storage: "Almacenamiento" } as const;

export const EXPERIENCE = {
  beginner: "Recién empiezo",
  "aws-user": "Uso AWS",
  architect: "Diseño arquitecturas",
  expert: "Experto",
} as const;

/** Ranks of the fixture game-rules.yaml: Constructor from 200 XP. */
export const RANKS = { first: "Aprendiz", second: "Constructor" } as const;
