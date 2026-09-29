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
    await user.click(screen.getByRole("button", { name: "Ver pista (−20 pts)" }));
    const popover = await screen.findByRole("dialog", { name: "Pistas · Entrada HTTPS" });
    expect(popover.textContent).toContain(HINTS[0]);
    expect(popover.textContent).not.toContain(HINTS[1]);
    expect(screen.getByText("Pistas 1/2")).toBeTruthy();
  });

  it('reveals one more hint per "Ver otra pista" until "Sin más pistas"', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Ver pista (−15 pts)" }));
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
        revealed={HINTS.slice(0, 1)}
        total={2}
        cost={15}
        canReveal
        onReveal={onReveal}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ver pistas" }));
    expect((await screen.findByRole("dialog")).textContent).toContain(HINTS[0]);
    expect(onReveal).not.toHaveBeenCalled();
  });

  it("does not offer another hint when the engine would reject it", async () => {
    const user = userEvent.setup();
    render(
      <HintAction
        role="Entrada HTTPS"
        revealed={HINTS.slice(0, 1)}
        total={2}
        cost={15}
        canReveal={false}
        onReveal={() => {}}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Ver pistas" }));
    await screen.findByRole("dialog");
    expect(screen.queryByRole("button", { name: /Ver otra pista/ })).toBeNull();
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
