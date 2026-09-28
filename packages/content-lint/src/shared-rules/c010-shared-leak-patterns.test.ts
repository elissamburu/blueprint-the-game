// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { runSharedRule } from "../testing/fixtures.js";
import { c010 } from "./c010-shared-leak-patterns.js";

describe("C010 leakPatterns shared between services", () => {
  it("passes when every pattern belongs to a single service", () => {
    expect(runSharedRule(c010)).toEqual([]);
  });

  it("ignores a pattern repeated inside the same service", () => {
    expect(
      runSharedRule(c010, (input) => {
        input.catalog[0]!.leakPatterns.push("s3");
      }),
    ).toEqual([]);
  });

  it("warns for the same pattern, ignoring case, in another service", () => {
    const issues = runSharedRule(c010, (input) => {
      input.catalog[1]!.leakPatterns.push("simple storage service");
    });
    expect(issues).toEqual([
      {
        code: "C010",
        severity: "warning",
        message:
          'El patrón "simple storage service" de "efs" ya lo usa "s3": L005 no puede distinguir cuál de los dos filtra; usá patrones más específicos.',
        path: ["catalog", 1, "leakPatterns", 2],
      },
    ]);
  });
});
