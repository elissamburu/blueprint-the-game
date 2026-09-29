// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// axe over the component catalog (RNF-02). jsdom has no layout, so rules that need rendering
// (color contrast) are checked in a real browser; see the PR for that run.
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      "alert-dialog-trigger",
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

  it("opens the AlertDialog example with the focus on «Cancelar»", async () => {
    const user = userEvent.setup();
    render(<ComponentCatalog />);
    await user.click(screen.getByRole("button", { name: "Reiniciar progreso" }));
    const dialog = await screen.findByRole("alertdialog", { name: "¿Reiniciar tu progreso?" });
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancelar" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
