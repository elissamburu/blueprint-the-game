// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe over the component catalog (RNF-02). jsdom has no layout, so rules that need rendering
// (color contrast) are checked in a real browser; see the PR for that run.
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, describe, expect, it } from "vitest";
import { ComponentCatalog } from "./component-catalog";

afterEach(cleanup);

describe("ComponentCatalog", () => {
  // axe over the whole catalog takes ~1.3 s locally but went past Vitest's 5 s default on the
  // Windows CI runner, so this test gets its own timeout.
  it("has no critical or serious axe violations", { timeout: 30_000 }, async () => {
    const { container } = render(<ComponentCatalog />);
    const results = await axe.run(container, {
      resultTypes: ["violations"],
      rules: { "color-contrast": { enabled: false } },
    });
    const blocking = results.violations
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map(
        (v) => `${v.id} (${v.impact ?? "?"}): ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`,
      );
    expect(blocking).toEqual([]);
  });

  it("renders every shared component", () => {
    const { container } = render(<ComponentCatalog />);
    for (const slot of [
      "grade-badge",
      "objective-tag",
      "level-badge",
      "button",
      "badge",
      "card",
      "popover-trigger",
      "tooltip-trigger",
      "dialog-trigger",
      "progress",
      "radio-group",
      "radio-card",
      "toggle",
      "separator",
      "scroll-area",
      "select-trigger",
    ]) {
      expect(container.querySelector(`[data-slot="${slot}"]`), slot).not.toBeNull();
    }
  });
});
