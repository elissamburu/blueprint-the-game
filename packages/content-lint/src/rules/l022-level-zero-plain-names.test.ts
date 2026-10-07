// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule } from "../testing/fixtures.js";
import { l022 } from "./l022-level-zero-plain-names.js";

/** Plain names for every entry the base scenario shows, except the ids in `without`. */
const withPlainNames =
  (...without: string[]) =>
  (_: unknown, input: { catalog: readonly { id: string }[] }) => {
    (input as { catalog: unknown[] }).catalog = input.catalog.map((entry) =>
      without.includes(entry.id) ? entry : { ...entry, plainName: `Nombre simple ${entry.id}` },
    );
  };

describe("L022 plainName at level 0", () => {
  it("does not apply outside level 0", () => {
    expect(runRule(l022)).toEqual([]);
  });

  it("passes when the resolved palette and the fixed nodes have plain names", () => {
    expect(
      runRule(l022, (scenario, input) => {
        scenario.level = 0;
        withPlainNames()(scenario, input);
      }),
    ).toEqual([]);
  });

  it("reports each entry once, at its first use or at the palette", () => {
    const issues = runRule(l022, (scenario, input) => {
      scenario.level = 0;
      // s3: answer; ec2: incorrect, also a confusion-group mate; cloudwatch: fixed node;
      // dynamodb: palette.extra.
      withPlainNames("s3", "ec2", "cloudwatch", "dynamodb")(scenario, input);
    });
    expect(issues.map((issue) => [issue.path, issue.message.slice(0, 40)])).toEqual([
      [
        ["diagram", "nodes", 1, "answers", 0, "service"],
        '"Amazon S3" (s3) se ve en un escenario d',
      ],
      [
        ["diagram", "nodes", 2, "incorrect", 0, "service"],
        '"Amazon EC2" (ec2) se ve en un escenario',
      ],
      [["palette", "extra", 0], '"Amazon DynamoDB" (dynamodb) se ve en un'],
      [["diagram", "nodes", 3, "service"], '"Amazon CloudWatch" (cloudwatch) se ve e'],
    ]);
    expect(issues[0]).toMatchObject({ code: "L022", severity: "error" });
    expect(issues[0]?.message).toBe(
      '"Amazon S3" (s3) se ve en un escenario de nivel 0 pero no tiene plainName en el catálogo: la tarjeta del nivel 0 muestra primero el nombre simple. Agregalo en content/catalog/services.yaml.',
    );
  });

  it("checks the palette the scenario resolves to, not only the services it names", () => {
    const issues = runRule(l022, (scenario, input) => {
      scenario.level = 0;
      // categories mode: every service of the categories of the answers (category "test").
      scenario.palette = { mode: "categories", extra: [] };
      withPlainNames("sqs")(scenario, input);
    });
    expect(issues.map((issue) => issue.path)).toEqual([["palette"]]);
    expect(issues[0]?.message).toContain("(sqs)");
  });

  it("skips entries missing from the catalog", () => {
    expect(
      runRule(l022, (scenario, input) => {
        scenario.level = 0;
        scenario.palette = { mode: "auto", extra: ["unknown"] };
        withPlainNames()(scenario, input);
      }),
    ).toEqual([]);
  });
});
