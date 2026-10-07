// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runRule, slotById } from "../testing/fixtures.js";
import { l021 } from "./l021-level-zero-analogy-limit.js";

const limit = {
  text: "En la nube no hay un depósito físico que visitar.",
  references: ["https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"],
};

describe("L021 analogyLimit at level 0", () => {
  it("does not apply outside level 0", () => {
    expect(runRule(l021)).toEqual([]);
  });

  it("fails for every optimal or acceptable answer without analogyLimit", () => {
    const issues = runRule(l021, (scenario) => {
      scenario.level = 0;
      slotById(scenario, "store").answers[0]!.analogyLimit = limit;
    });
    expect(issues).toEqual([
      {
        code: "L021",
        severity: "error",
        message:
          'La respuesta optimal "lambda" del casillero "thumbnailer" no tiene analogyLimit: en el nivel 0 cada respuesta explica dónde se rompe la analogía, con al menos una referencia oficial.',
        path: ["diagram", "nodes", 2, "answers", 0],
      },
      expect.objectContaining({ path: ["diagram", "nodes", 2, "answers", 1] }),
    ]);
    expect(issues[1]?.message).toContain('La respuesta acceptable "fargate"');
  });

  it("passes when every answer has analogyLimit; incorrect services need none", () => {
    expect(
      runRule(l021, (scenario) => {
        scenario.level = 0;
        for (const id of ["store", "thumbnailer"]) {
          for (const answer of slotById(scenario, id).answers) answer.analogyLimit = limit;
        }
      }),
    ).toEqual([]);
  });
});
