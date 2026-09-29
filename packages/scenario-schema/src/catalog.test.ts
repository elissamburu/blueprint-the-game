// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseCategories, parseConfusionGroups, parseServices, type ParseResult } from "./index.js";

const ok = <T>(result: ParseResult<T>): T => {
  if (!result.success)
    throw new Error(result.issues.map((i) => `${i.where}: ${i.message}`).join("\n"));
  return result.data;
};
const messages = <T>(result: ParseResult<T>): string[] =>
  result.success ? [] : result.issues.map((i) => `${i.where}: ${i.message}`);

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
    expect(service?.ssmNamespaces).toEqual([]);
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
      "[0] (s3).leakPatterns: El servicio necesita al menos un patrón de filtración (leakPatterns)",
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
    expect(service?.icon).toBeUndefined();
  });

  it.each([
    "Arch_Amazon-Simple-Queue-Service_48",
    "Res_Amazon-VPC_NAT-Gateway_48",
    "Res_Elastic-Load-Balancing_Application-Load-Balancer_48",
  ])("accepts %s", (icon) => {
    expect(ok(parseServices([{ ...base, icon }]))[0]?.icon).toBe(icon);
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
