// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioFinding } from "../../shared/validation";
import { ValidationPanel } from "./ValidationPanel";

afterEach(cleanup);

const finding = (overrides: Partial<StudioFinding>): StudioFinding => ({
  code: "L005",
  severity: "error",
  message: "El título nombra un servicio oculto.",
  where: "title",
  path: ["title"],
  line: 9,
  column: 1,
  ...overrides,
});

const renderPanel = (findings: StudioFinding[] | undefined, onJump = vi.fn()) => {
  render(<ValidationPanel headingId="v" findings={findings} pending={false} onJump={onJump} />);
  return onJump;
};

describe("ValidationPanel", () => {
  it("is a region named by its heading", () => {
    renderPanel([]);
    screen.getByRole("region", { name: "Validación" });
    screen.getByRole("heading", { level: 2, name: "Validación" });
  });

  it.each([
    [[], "Sin errores ni advertencias"],
    [[finding({})], "1 error"],
    [[finding({}), finding({ line: 3 })], "2 errores"],
    [[finding({ severity: "warning" })], "1 advertencia"],
    [[finding({}), finding({}), finding({ severity: "warning" })], "2 errores, 1 advertencia"],
  ])("announces only the summary in a polite live region (%#)", (findings, summary) => {
    renderPanel(findings);
    const live = screen.getByRole("status");
    expect(live.getAttribute("aria-live")).toBe("polite");
    expect(live.textContent).toBe(summary);
    // The list of findings is outside the live region.
    expect(within(live).queryAllByRole("button")).toEqual([]);
  });

  it("shows each finding as a button with icon, severity in words, code, line and message", async () => {
    const onJump = renderPanel([
      finding({}),
      finding({
        code: "L016",
        severity: "warning",
        message: "Pocos distractores.",
        where: "",
        line: 30,
      }),
    ]);
    const [first, second] = screen.getAllByRole("button");
    if (first === undefined || second === undefined) throw new Error("two buttons expected");
    for (const text of [
      "Error",
      "L005",
      "Línea 9",
      "El título nombra un servicio oculto.",
      "title",
    ]) {
      expect(first.textContent).toContain(text);
    }
    expect(second.textContent).toContain("Advertencia");
    expect(first.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");

    await userEvent.click(second);
    expect(onJump).toHaveBeenCalledWith(expect.objectContaining({ code: "L016", line: 30 }));
  });

  it("shows a problem instead of the summary when the validation cannot run", () => {
    render(
      <ValidationPanel
        headingId="v"
        findings={undefined}
        pending
        problem="No se pudo validar."
        onJump={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("No se pudo validar.");
  });
});
