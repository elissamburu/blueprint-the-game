// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import {
  CONCEPT_GLYPHS,
  parseCategories,
  parseConfusionGroups,
  parseServices,
  type AwsService,
  type ParseResult,
  type Service,
} from "./index.js";

const ok = <T>(result: ParseResult<T>): T => {
  if (!result.success)
    throw new Error(result.issues.map((i) => `${i.where}: ${i.message}`).join("\n"));
  return result.data;
};
const messages = <T>(result: ParseResult<T>): string[] =>
  result.success ? [] : result.issues.map((i) => `${i.where}: ${i.message}`);

/** Narrows a parsed entry to a service, failing the test otherwise. */
const asService = (entry: Service | undefined): AwsService => {
  if (entry?.type !== "service") throw new Error(`expected a service, got ${entry?.type}`);
  return entry;
};

// Shape from docs/03 §4.
const s3 = `
- id: s3
  name: Amazon S3
  fullName: Amazon Simple Storage Service
  category: storage
  aliases: [s3, simple storage]
  leakPatterns: ["S3", "Simple Storage Service"]
  short: "Almacenamiento de objetos durable y escalable, pago por uso."
  whenToUse: "Archivos y objetos de cualquier tamaño."
  whenNotToUse: "Discos de bloque para una instancia."
  docs: https://docs.aws.amazon.com/s3/
  ssmNamespaces: [s3]
  icon: Arch_Amazon-Simple-Storage-Service_48
  status: active
  since: 2006
`;

describe("parseServices", () => {
  it("accepts the documented service shape", () => {
    const [service] = ok(parseServices(parseYaml(s3)));
    expect(service?.leakPatterns).toEqual(["S3", "Simple Storage Service"]);
  });

  it("defaults optional lists", () => {
    const [service] = ok(
      parseServices([
        {
          id: "sqs",
          name: "Amazon SQS",
          category: "application-integration",
          leakPatterns: ["SQS"],
          short: "Colas de mensajes administradas.",
          docs: "https://docs.aws.amazon.com/sqs/",
          icon: "Arch_Amazon-Simple-Queue-Service_48",
          status: "active",
        },
      ]),
    );
    expect(service?.aliases).toEqual([]);
    expect(asService(service).ssmNamespaces).toEqual([]);
  });

  it("rejects missing leak patterns, http docs and unknown status", () => {
    const [raw] = parseYaml(s3) as Record<string, unknown>[];
    const service = {
      ...raw,
      leakPatterns: [],
      docs: "http://docs.aws.amazon.com/s3/",
      status: "legacy",
    };
    expect(messages(parseServices([service]))).toEqual([
      "[0] (s3).leakPatterns: La entrada necesita al menos un patrón de filtración (leakPatterns)",
      '[0] (s3).docs: "http://docs.aws.amazon.com/s3/" no es una URL válida: tiene que empezar con https://',
      '[0] (s3).status: status "legacy" no es válido: usá "active", "deprecated"',
    ]);
  });
});

describe("service icon", () => {
  const base = {
    id: "sqs",
    name: "Amazon SQS",
    category: "application-integration",
    leakPatterns: ["SQS"],
    short: "Colas de mensajes administradas.",
    docs: "https://docs.aws.amazon.com/sqs/",
    status: "active",
  };

  it("is optional", () => {
    const [service] = ok(parseServices([base]));
    expect(asService(service).icon).toBeUndefined();
  });

  it.each([
    "Arch_Amazon-Simple-Queue-Service_48",
    "Res_Amazon-VPC_NAT-Gateway_48",
    "Res_Elastic-Load-Balancing_Application-Load-Balancer_48",
  ])("accepts %s", (icon) => {
    expect(asService(ok(parseServices([{ ...base, icon }]))[0]).icon).toBe(icon);
  });

  it.each([
    "Arch_Amazon-Simple-Queue-Service_48.svg",
    "Arch_Amazon-Simple-Queue-Service_64",
    "Amazon-Simple-Queue-Service",
    "Arch_Amazon-Simple-Queue-Service_48_Dark",
    "../Arch_X_48",
  ])("rejects %s", (icon) => {
    expect(messages(parseServices([{ ...base, icon }]))).toEqual([
      `[0] (sqs).icon: ${JSON.stringify(icon)} no es un ícono válido: usá el nombre base de un ícono de 48 px del paquete oficial, sin extensión (Arch_…_48 o Res_…_48)`,
    ]);
  });
});

describe("entry type", () => {
  const [rawS3] = parseYaml(s3) as Record<string, unknown>[];

  it("defaults to service, so the existing entries do not change", () => {
    const [service] = ok(parseServices([rawS3]));
    expect(service?.type).toBe("service");
    expect(ok(parseServices([{ ...rawS3, type: "service" }]))).toEqual([service]);
  });

  it("rejects an unknown type", () => {
    expect(messages(parseServices([{ ...rawS3, type: "idea" }]))).toEqual([
      '[0] (s3).type: type "idea" no es válido: usá "service", "concept"',
    ]);
  });

  it("does not accept a glyph in a service", () => {
    expect(messages(parseServices([{ ...rawS3, glyph: "region" }]))).toEqual([
      '[0] (s3): Campo desconocido: "glyph" (¿está bien escrito?)',
    ]);
  });
});

describe("concept", () => {
  const region = {
    type: "concept",
    id: "region",
    name: "Región de AWS",
    plainName: "Lugar del mundo",
    category: "concept-global-infrastructure",
    leakPatterns: ["Región de AWS"],
    short: "Área geográfica con varias zonas de disponibilidad aisladas.",
    docs: "https://docs.aws.amazon.com/whitepapers/latest/aws-overview/global-infrastructure.html",
    glyph: "region",
    status: "active",
  };

  it("accepts the documented shape", () => {
    const [concept] = ok(parseServices([region]));
    expect(concept).toEqual({ ...region, aliases: [] });
  });

  it("only needs the same required fields as a service", () => {
    const { glyph: _glyph, plainName: _plainName, ...minimal } = region;
    expect(ok(parseServices([minimal]))[0]?.type).toBe("concept");
  });

  it.each([
    ["icon", "Arch_Amazon-EC2_48"],
    ["ssmNamespaces", ["ec2"]],
  ])("rejects %s instead of ignoring it", (key, value) => {
    expect(messages(parseServices([{ ...region, [key]: value }]))).toEqual([
      `[0] (region): Campo desconocido: "${key}" (¿está bien escrito?)`,
    ]);
  });

  it("rejects a glyph outside CONCEPT_GLYPHS", () => {
    expect(messages(parseServices([{ ...region, glyph: "map-pin" }]))).toEqual([
      `[0] (region).glyph: glyph "map-pin" no es válido: usá ${CONCEPT_GLYPHS.map((g) => `"${g}"`).join(", ")}`,
    ]);
  });

  it("accepts every glyph of the closed set", () => {
    for (const glyph of CONCEPT_GLYPHS) {
      expect(parseServices([{ ...region, glyph }]).success).toBe(true);
    }
  });

  it("requires the leak patterns, the docs and the status", () => {
    const { leakPatterns: _l, docs: _d, status: _s, ...partial } = region;
    expect(messages(parseServices([partial]))).toEqual([
      '[0] (region).leakPatterns: Falta el campo obligatorio "leakPatterns"',
      '[0] (region).docs: Falta el campo obligatorio "docs"',
      '[0] (region).status: Opción inválida: se esperaba una de "active"|"deprecated"',
    ]);
  });
});

describe("plainName", () => {
  const [rawS3] = parseYaml(s3) as Record<string, unknown>[];

  it("is optional in services and accepts up to 40 characters", () => {
    expect(ok(parseServices([rawS3]))[0]?.plainName).toBeUndefined();
    const plainName = "x".repeat(40);
    expect(ok(parseServices([{ ...rawS3, plainName }]))[0]?.plainName).toBe(plainName);
  });

  it("rejects 41 characters and empty values", () => {
    expect(messages(parseServices([{ ...rawS3, plainName: "x".repeat(41) }]))).toEqual([
      "[0] (s3).plainName: Puede tener como máximo 40 caracteres (tiene 41)",
    ]);
    expect(messages(parseServices([{ ...rawS3, plainName: "  " }]))).toEqual([
      "[0] (s3).plainName: No puede estar vacío",
    ]);
  });
});

describe("parseCategories", () => {
  it("accepts categories with adjacencies", () => {
    const categories = ok(
      parseCategories([
        { id: "storage", name: "Almacenamiento", adjacent: ["database"] },
        { id: "database", name: "Bases de datos" },
      ]),
    );
    expect(categories[1]?.adjacent).toEqual([]);
  });

  it("defaults kind to service and accepts concept categories", () => {
    const categories = ok(
      parseCategories([
        { id: "storage", name: "Almacenamiento" },
        { id: "concept-global-infrastructure", name: "Infraestructura global", kind: "concept" },
      ]),
    );
    expect(categories.map((c) => c.kind)).toEqual(["service", "concept"]);
  });

  it("rejects an unknown kind", () => {
    expect(
      messages(parseCategories([{ id: "storage", name: "Almacenamiento", kind: "idea" }])),
    ).toEqual(['[0] (storage).kind: kind "idea" no es válido: usá "service", "concept"']);
  });

  it("rejects ids that are not kebab-case", () => {
    expect(messages(parseCategories([{ id: "Storage", name: "Almacenamiento" }]))).toEqual([
      '[0] (Storage).id: "Storage" no es un id válido: usá kebab-case (minúsculas, números y guiones, p. ej. "mi-servicio")',
    ]);
  });
});

describe("parseConfusionGroups", () => {
  it("accepts the documented groups", () => {
    const groups = ok(
      parseConfusionGroups(
        parseYaml(`
- id: messaging
  services: [sqs, sns, eventbridge, kinesis-data-streams, mq]
  note: "Colas vs pub/sub vs bus de eventos vs streaming."
- id: relational
  services: [rds, aurora, aurora-dsql, redshift]
`),
      ),
    );
    expect(groups).toHaveLength(2);
  });

  it("needs at least two services", () => {
    expect(messages(parseConfusionGroups([{ id: "solo", services: ["sqs"] }]))).toEqual([
      "[0] (solo).services: Un grupo de confusión necesita al menos dos servicios",
    ]);
  });
});
