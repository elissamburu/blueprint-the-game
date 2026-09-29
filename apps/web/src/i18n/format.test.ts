// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { formatNumber } from "./format";

describe("formatNumber", () => {
  it("groups thousands from four digits and uses a decimal comma", () => {
    expect(formatNumber(1840)).toBe("1.840");
    expect(formatNumber(45000)).toBe("45.000");
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatNumber(700)).toBe("700");
  });
});
