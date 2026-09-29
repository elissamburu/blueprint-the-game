// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button } from "./button";
import { Toggle } from "./toggle";

afterEach(cleanup);

describe("Toggle chip variant", () => {
  // The onboarding area chips of the prototype are Buttons of the default size (.chip-grid).
  it("renders with the height, padding and text size of a default Button", () => {
    render(
      <>
        <Toggle variant="chip">Redes</Toggle>
        <Button variant="outline">Jugar</Button>
      </>,
    );
    const chip = screen.getByRole("button", { name: "Redes" }).classList;
    const button = screen.getByRole("button", { name: "Jugar" }).classList;
    for (const token of ["h-9", "px-4", "py-2", "text-sm", "font-medium", "gap-2"]) {
      expect(button.contains(token), `button ${token}`).toBe(true);
      expect(chip.contains(token), `chip ${token}`).toBe(true);
    }
    expect(chip.contains("px-2")).toBe(false);
  });

  it("exposes the selected state as aria-pressed", () => {
    render(
      <Toggle variant="chip" defaultPressed>
        Redes
      </Toggle>,
    );
    expect(screen.getByRole("button", { name: "Redes" }).getAttribute("aria-pressed")).toBe("true");
  });
});
