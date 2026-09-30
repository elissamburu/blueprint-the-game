// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { HintAction, showsHintAction } from "./HintAction";

afterEach(cleanup);

const HINTS = ["Pensá en algo que cobre por pedido.", "Tiene que validar la identidad."];

/** Reveals from the fixture list, as the engine does with useHint. */
function Harness({ cost = 15, canReveal = true }: { cost?: number; canReveal?: boolean }) {
  const [used, setUsed] = useState(0);
  return (
    <HintAction
      role="Entrada HTTPS"
      slotNumber={3}
      revealed={HINTS.slice(0, used)}
      total={HINTS.length}
      cost={cost}
      canReveal={canReveal && used < HINTS.length}
      onReveal={() => setUsed((n) => n + 1)}
    />
  );
}

describe("HintAction", () => {
  it("shows the cost from game-rules and reveals the first hint in a popover", async () => {
    const user = userEvent.setup();
    render(<Harness cost={20} />);
    expect(screen.getByText("Pistas 0/2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Ver pista (−20 pts), casillero 3" }));
    const popover = await screen.findByRole("dialog", { name: "Pistas · Entrada HTTPS" });
    expect(popover.textContent).toContain(HINTS[0]);
    expect(popover.textContent).not.toContain(HINTS[1]);
    expect(screen.getByText("Pistas 1/2")).toBeTruthy();
  });

  it('reveals one more hint per "Ver otra pista" until "Sin más pistas"', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Ver pista (−15 pts), casillero 3" }));
    await user.click(await screen.findByRole("button", { name: "Ver otra pista (−15 pts)" }));
    const popover = screen.getByRole("dialog");
    expect(popover.textContent).toContain(HINTS[1]);
    expect(popover.textContent).toContain("Sin más pistas");
    expect(screen.queryByRole("button", { name: /Ver otra pista/ })).toBeNull();
    expect(screen.getByText("Pistas 2/2")).toBeTruthy();
  });

  it("reopens the revealed hints without spending another one", async () => {
    const user = userEvent.setup();
    const onReveal = vi.fn();
    render(
      <HintAction
        role="Entrada HTTPS"
        slotNumber={3}
        revealed={HINTS.slice(0, 1)}
        total={2}
        cost={15}
        canReveal
        onReveal={onReveal}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ver pistas, casillero 3" }));
    expect((await screen.findByRole("dialog")).textContent).toContain(HINTS[0]);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("does not offer another hint when the engine would reject it", async () => {
    const user = userEvent.setup();
    render(
      <HintAction
        role="Entrada HTTPS"
        slotNumber={3}
        revealed={HINTS.slice(0, 1)}
        total={2}
        cost={15}
        canReveal={false}
        onReveal={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ver pistas, casillero 3" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /Ver otra pista/ })).toBeNull();
  });
});

describe("HintAction accessible name (WCAG 2.4.6, 2.5.3)", () => {
  const button = (revealed: number, slotNumber = 3, roleId?: string) => {
    render(
      <HintAction
        role="Entrada HTTPS"
        slotNumber={slotNumber}
        roleId={roleId}
        revealed={HINTS.slice(0, revealed)}
        total={HINTS.length}
        cost={15}
        canReveal
        onReveal={() => {}}
      />,
    );
    const found = screen.getByRole("button");
    const result = {
      text: found.textContent,
      name: found.getAttribute("aria-label"),
      describedBy: found.getAttribute("aria-describedby"),
    };
    cleanup();
    return result;
  };

  it.each([
    [0, "Ver pista (−15 pts)"],
    [1, "Ver pistas"],
    [2, "Sin más pistas"],
  ])("with %i hints revealed starts with the visible text and ends with the slot", (used, text) => {
    expect(button(used)).toMatchObject({ text, name: `${text}, casillero 3` });
  });

  it("is described by the role text of its slot, which is not part of the name", () => {
    expect(button(0, 3, "rol-3").describedBy).toBe("rol-3");
    expect(button(0).describedBy).toBeNull();
    expect(button(0).name).not.toContain("Entrada HTTPS");
  });

  it("differs between the slots of a board in the same state", () => {
    expect(button(0, 1).name).not.toBe(button(0, 2).name);
  });
});

describe("showsHintAction", () => {
  it("needs hints, and one revealed or revealable", () => {
    expect(showsHintAction(0, 0, true)).toBe(false);
    expect(showsHintAction(2, 0, false)).toBe(false);
    expect(showsHintAction(2, 0, true)).toBe(true);
    expect(showsHintAction(2, 1, false)).toBe(true);
  });
});
