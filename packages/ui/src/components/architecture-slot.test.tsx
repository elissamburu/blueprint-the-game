// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArchitectureSlot, slotAccessibleName } from "./architecture-slot";
import type { SlotGrade } from "./grade-badge";

afterEach(cleanup);

const service = { name: "Amazon S3", category: "storage" };

describe("slotAccessibleName", () => {
  it('without a number reads "<rol>. <estado>[: <servicio>]", not doubling the period', () => {
    expect(
      slotAccessibleName({ role: "Guarda el PDF.", grade: "optimal", serviceName: "Amazon S3" }),
    ).toBe("Guarda el PDF. Óptimo: Amazon S3");
    expect(slotAccessibleName({ role: "Guarda el PDF", grade: "empty" })).toBe(
      "Guarda el PDF. Vacío",
    );
  });

  it("with a number is short: the visible text first, then the slot, without the role", () => {
    const role = "Guarda el PDF.";
    expect(
      slotAccessibleName({ role, grade: "optimal", number: 2, serviceName: "Amazon S3" }),
    ).toBe("Óptimo: Amazon S3, casillero 2");
    expect(
      slotAccessibleName({
        role,
        grade: "empty",
        number: 3,
        emptyText: "Arrastrá o elegí un servicio",
      }),
    ).toBe("Arrastrá o elegí un servicio, casillero 3");
    // A board that cannot be played shows no placeholder: the state names the slot.
    expect(slotAccessibleName({ role, grade: "empty", number: 3, emptyText: "" })).toBe(
      "Vacío, casillero 3",
    );
  });

  it("is different for every slot of a board, whatever their roles and states", () => {
    const names = [1, 2, 3].map((number) =>
      slotAccessibleName({ role: "Mismo rol", grade: "empty", number, emptyText: "Elegí" }),
    );
    expect(new Set(names).size).toBe(names.length);
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

describe("ArchitectureSlot states", () => {
  it("tells every state apart by border style too, not only by color (forced colors)", () => {
    const border = (grade: SlotGrade) => {
      const { container } = render(<ArchitectureSlot grade={grade} role="Rol" />);
      const slot = container.querySelector<HTMLElement>("[data-slot=architecture-slot]");
      return [...(slot?.classList ?? [])].find((c) => /^border-(solid|dashed|double)$/.test(c));
    };
    expect(border("empty")).toBe("border-dashed");
    expect(border("optimal")).toBe("border-solid");
    // "Solución vista" never looks like a green: double border, blueprint instead of success.
    expect(border("revealed")).toBe("border-double");
  });

  it("names a revealed slot as a viewed solution, not as optimal", () => {
    const slot = { role: "Guarda el PDF", grade: "revealed", serviceName: "S3" } as const;
    expect(slotAccessibleName(slot)).toBe("Guarda el PDF. Solución vista: S3");
    expect(slotAccessibleName({ ...slot, number: 1 })).toBe("Solución vista: S3, casillero 1");
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
    expect(role.className).not.toMatch(/line-clamp|truncate|overflow|ellipsis/);
  });

  it("with a number, describes the slot with the visible role instead of naming it with it", () => {
    const { rerender } = render(
      <ArchitectureSlot grade="empty" role={ROLE} number={4} onActivate={() => {}} />,
    );
    const main = screen.getByRole("button", { name: "Arrastrá o elegí un servicio, casillero 4" });
    expect(main.getAttribute("aria-describedby")).toBe(screen.getByText(ROLE).id);
    // The app can choose the id, to describe its own controls of the slot with the role too.
    rerender(
      <ArchitectureSlot
        grade="optimal"
        role={ROLE}
        number={4}
        roleId="rol-4"
        service={service}
        onActivate={() => {}}
      />,
    );
    expect(screen.getByText(ROLE).id).toBe("rol-4");
    expect(
      screen
        .getByRole("button", { name: "Óptimo: Amazon S3, casillero 4" })
        .getAttribute("aria-describedby"),
    ).toBe("rol-4");
  });

  it("without a number has no description: the role is already in the name", () => {
    render(<ArchitectureSlot grade="empty" role={ROLE} onActivate={() => {}} />);
    expect(screen.getByRole("button").hasAttribute("aria-describedby")).toBe(false);
  });

  it("grows instead of clipping when the text needs more room (larger browser font)", () => {
    const { container } = render(
      <ArchitectureSlot grade="optimal" role={ROLE} service={service} onActivate={() => {}} />,
    );
    const slot = container.querySelector<HTMLElement>("[data-slot=architecture-slot]");
    expect(slot?.className).not.toMatch(/overflow-hidden|(^|\s)h-/);
    // Neither the service chip nor the placeholder has a fixed height.
    expect(container.innerHTML).not.toMatch(/\sh-\[/);
  });
});

/**
 * End of a CSS animation as React hears it in jsdom: without AnimationEvent in the window, React
 * listens to the prefixed webkitAnimationEnd (fireEvent.animationEnd would go unheard).
 */
const animationEnd = (element: Element) =>
  fireEvent(element, new Event("webkitAnimationEnd", { bubbles: true }));

describe("ArchitectureSlot motion (RF-PLAY-17)", () => {
  const TRANSFORMS = /\b(zoom-in|slide-in-from)-/;
  const parts = (container: HTMLElement) => ({
    service: container.querySelector<HTMLElement>("[data-slot=architecture-slot-service]"),
    badge: container.querySelector<HTMLElement>("[data-slot=grade-badge]"),
    icon: container.querySelector<SVGElement>("[data-slot=grade-badge] svg"),
  });
  const motion = { key: 1, placed: true, graded: true };

  it("moves nothing without a motion", () => {
    const { container } = render(<ArchitectureSlot grade="optimal" role="r" service={service} />);
    const { service: placed, badge, icon } = parts(container);
    for (const element of [placed, badge, icon]) {
      expect(element?.getAttribute("class")).not.toMatch(/animate-in/);
    }
  });

  it("settles the placed service and pops the icon of a green in", () => {
    const { container } = render(
      <ArchitectureSlot grade="optimal" role="r" service={service} motion={motion} />,
    );
    const { service: placed, badge, icon } = parts(container);
    expect(placed?.className).toMatch(/animate-in .*slide-in-from-top-\[6px\] zoom-in-96/);
    expect(icon?.getAttribute("class")).toMatch(/animate-in .*zoom-in-60/);
    // The text of the grade is still from the first frame.
    expect(badge?.className).not.toMatch(/animate-in/);
  });

  it("fades the whole label of an incorrect in, without transform, and raises a revealed one", () => {
    const { container, rerender } = render(
      <ArchitectureSlot grade="incorrect" role="r" service={service} motion={motion} />,
    );
    expect(parts(container).badge?.className).toMatch(/animate-in fade-in/);
    expect(parts(container).badge?.className).not.toMatch(TRANSFORMS);
    rerender(
      <ArchitectureSlot
        grade="revealed"
        role="r"
        service={service}
        motion={{ ...motion, key: 2 }}
      />,
    );
    expect(parts(container).badge?.className).toMatch(/slide-in-from-bottom-\[12px\]/);
  });

  it("with reduced motion only fades, without transform classes", () => {
    const grades: SlotGrade[] = ["optimal", "acceptable", "incorrect", "revealed"];
    for (const grade of grades) {
      const { container } = render(
        <ArchitectureSlot grade={grade} role="r" service={service} motion={motion} reducedMotion />,
      );
      const { service: placed, badge, icon } = parts(container);
      const classes = [placed, badge, icon].map((e) => e?.getAttribute("class") ?? "").join(" ");
      expect(classes).toMatch(/fade-in duration-\(--motion-reduced-fade\)/);
      expect(classes).not.toMatch(TRANSFORMS);
      cleanup();
    }
  });

  it("tells when its last animation ends, once per motion", () => {
    const onMotionEnd = vi.fn();
    const { container } = render(
      <ArchitectureSlot
        grade="acceptable"
        role="r"
        service={service}
        motion={motion}
        onMotionEnd={onMotionEnd}
      />,
    );
    const { service: placed, icon } = parts(container);
    // The settle (200 ms) ends before the grade (260 ms): it is not the end yet.
    animationEnd(placed as HTMLElement);
    expect(onMotionEnd).not.toHaveBeenCalled();
    animationEnd(icon as SVGElement);
    expect(onMotionEnd).toHaveBeenCalledTimes(1);
  });
});
