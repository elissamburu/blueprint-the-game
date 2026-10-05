// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { i18n } from "./index";

describe("i18n", () => {
  it("keeps the generic text the play namespace copies equal to the app's", () => {
    // @blueprint/play cannot read this app's keys: "(se abre en otra pestaña)" lives in both.
    expect(i18n.t("play:external")).toBe(i18n.t("about.external"));
  });
});
