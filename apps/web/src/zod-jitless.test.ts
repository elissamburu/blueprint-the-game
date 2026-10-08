// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { z } from "./zod-jitless";

describe("zod-jitless", () => {
  it("is Zod with its JIT turned off (needs eval; ADR-0028)", () => {
    expect(z.config().jitless).toBe(true);
    expect(z.object({ id: z.string() }).parse({ id: "a" })).toEqual({ id: "a" });
  });
});
