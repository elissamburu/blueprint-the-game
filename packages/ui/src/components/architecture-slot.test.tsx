// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchitectureSlot, slotAccessibleName } from "./architecture-slot";

afterEach(cleanup);

const service = { name: "Amazon S3", category: "storage" };

describe("slotAccessibleName", () => {
  it('reads "<rol>. <estado>[: <servicio>]" without doubling the period of the role', () => {
    expect(slotAccessibleName("Guarda el PDF.", "optimal", "Amazon S3")).toBe(
      "Guarda el PDF. Óptimo: Amazon S3",
    );
    expect(slotAccessibleName("Guarda el PDF", "empty")).toBe("Guarda el PDF. Vacío");
  });
});

describe("ArchitectureSlot", () => {
  it("is a button with the slot name and its selection when it can be activated", () => {
    const onActivate = vi.fn();
    render(
      <ArchitectureSlot
        grade="incorrect"
        role="Rol"
        service={service}
        selected
        onActivate={onActivate}
      />,
    );
    const button = screen.getByRole("button", { name: "Rol. Incorrecto: Amazon S3" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it("is not focusable without onActivate", () => {
    render(<ArchitectureSlot grade="empty" role="Rol" hints={{ used: 1, total: 2 }} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("group", { name: "Rol. Vacío" }).textContent).toContain("Vacío");
    expect(screen.getByText("Pistas 1/2")).toBeDefined();
  });

  it("hides the hint counter without hints and lets the app replace the hint row", () => {
    const { rerender } = render(
      <ArchitectureSlot grade="empty" role="Rol" hints={{ used: 0, total: 0 }} />,
    );
    expect(screen.queryByText(/Pistas/)).toBeNull();
    rerender(
      <ArchitectureSlot
        grade="empty"
        role="Rol"
        hintAction={<button type="button">Ver pista</button>}
      />,
    );
    expect(screen.getByRole("button", { name: "Ver pista" })).toBeDefined();
  });
});

describe("ArchitectureSlot role", () => {
  const ROLE =
    "Cola administrada donde otro sistema deja trabajos pendientes; el servicio los toma a su ritmo y los borra al terminarlos.";

  it("shows the whole role, never clamped, and names the slot with it", () => {
    render(<ArchitectureSlot grade="empty" role={ROLE} onActivate={() => {}} />);
    const main = screen.getByRole("button");
    expect(main.getAttribute("aria-label")).toBe(`${ROLE.slice(0, -1)}. Vacío`);
    const role = screen.getByText(ROLE);
    expect(role.className).not.toMatch(/line-clamp|truncate/);
  });
});
