// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { commands, slotStatus, type Command } from "@blueprint/game-engine";
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../../i18n";
import { createSessionStore } from "./session-store";
import { bundle, pdfScenario, services, slotOf } from "./testing/game-fixture";
import { useGameController, type GameController, type Names } from "./use-game-controller";

const names: Names = {
  serviceName: (id) => services.get(id)?.name ?? id,
  slotRole: (id) => slotOf(pdfScenario, id).role,
};

/** A controller over a real session store, with every dispatched command recorded. */
const setup = () => {
  const store = createSessionStore();
  store.getState().start(pdfScenario, bundle.rules);
  const log: Command[] = [];
  const dispatch = store.getState().dispatch;
  store.setState({
    dispatch: (command) => {
      log.push(command);
      return dispatch(command);
    },
  });
  const { result } = renderHook(() => useGameController(store, names));
  const run = (gesture: (game: GameController) => void) => act(() => gesture(result.current));
  const status = (slotId: string) => {
    const slot = result.current.session.slots.find((s) => s.slotId === slotId);
    return slot === undefined ? null : slotStatus(slot);
  };
  return { result, log, run, status };
};

const place = commands.placeService("upload-store", "s3");

describe("useGameController: the three adapters emit the same engine commands", () => {
  it("drag", () => {
    const { log, run, status, result } = setup();
    run((g) => g.drop("upload-store", "s3"));
    expect(log).toEqual([place]);
    expect(status("upload-store")).toBe("optimal");
    expect(result.current.feedbackSlotId).toBe("upload-store");
  });

  it("slot first", () => {
    const { log, run, status, result } = setup();
    run((g) => g.activateSlot("upload-store"));
    expect(result.current.session.selectedSlotId).toBe("upload-store");
    run((g) => g.chooseService("s3"));
    expect(log).toEqual([commands.selectSlot("upload-store"), place, commands.selectSlot(null)]);
    expect(status("upload-store")).toBe("optimal");
    expect(result.current.session.selectedSlotId).toBeNull();
    expect(result.current.feedbackSlotId).toBe("upload-store");
  });

  it("service first", () => {
    const { log, run, status, result } = setup();
    run((g) => g.chooseService("s3"));
    expect(result.current.pendingServiceId).toBe("s3");
    expect(log).toEqual([]);
    run((g) => g.activateSlot("upload-store"));
    expect(log).toEqual([place]);
    expect(status("upload-store")).toBe("optimal");
    expect(result.current.pendingServiceId).toBeNull();
  });
});

describe("useGameController", () => {
  it("announces each placement with the service, the role and the grade", () => {
    const { run, result } = setup();
    run((g) => g.activateSlot("upload-store"));
    run((g) => g.chooseService("ebs"));
    expect(result.current.announcement.text).toBe(
      `Amazon EBS en «${names.slotRole("upload-store")}»: Incorrecto.`,
    );
    const { key } = result.current.announcement;
    run((g) => g.drop("upload-store", "ebs"));
    // Rejected (already placed): announced, with a new key even if the text repeats.
    expect(result.current.announcement.text).toBe("Ese servicio ya está en el casillero.");
    expect(result.current.announcement.key).toBeGreaterThan(key);
  });

  it("Esc cancels the selected slot or the pending service, and nothing else", () => {
    const { run, result, log } = setup();
    let cancelled = true;
    run((g) => {
      cancelled = g.cancel();
    });
    expect(cancelled).toBe(false);
    run((g) => g.activateSlot("upload-store"));
    run((g) => {
      cancelled = g.cancel();
    });
    expect(cancelled).toBe(true);
    expect(log.at(-1)).toEqual(commands.selectSlot(null));
    run((g) => g.chooseService("s3"));
    run((g) => {
      cancelled = g.cancel();
    });
    expect(cancelled).toBe(true);
    expect(result.current.pendingServiceId).toBeNull();
    expect(result.current.announcement.text).toBe("Selección cancelada.");
  });

  it("accepts an orange and retries it by clearing and selecting the slot", () => {
    const { run, status, log, result } = setup();
    run((g) => g.drop("url-signer", "fargate"));
    run((g) => g.accept("url-signer"));
    expect(status("url-signer")).toBe("accepted");
    run((g) => g.retry("url-signer"));
    expect(log.slice(-2)).toEqual([
      commands.clearSlot("url-signer"),
      commands.selectSlot("url-signer"),
    ]);
    expect(status("url-signer")).toBe("empty");
    expect(result.current.session.selectedSlotId).toBe("url-signer");
  });

  it("reveals hints with useHint", () => {
    const { run, log, result } = setup();
    run((g) => g.revealHint("api-entry"));
    expect(log).toEqual([commands.useHint("api-entry")]);
    expect(result.current.announcement.text).toBe(
      `Pista 1: ${slotOf(pdfScenario, "api-entry").hints[0]}`,
    );
  });

  it("reveals the solution of one slot, shows its feedback and announces it once", () => {
    const { run, log, result, status } = setup();
    run((g) => g.chooseService("ebs"));
    run((g) => g.revealSolution("upload-store"));
    expect(log).toEqual([commands.revealSolution("upload-store")]);
    expect(status("upload-store")).toBe("revealed");
    expect(result.current.pendingServiceId).toBeNull();
    expect(result.current.feedbackSlotId).toBe("upload-store");
    expect(result.current.announcement.text).toBe(
      `Solución de «${names.slotRole("upload-store")}»: Amazon S3. No suma puntos.`,
    );
  });

  it("reveals the whole solution with a single announcement and no feedback card", () => {
    const { run, result } = setup();
    run((g) => g.drop("upload-store", "s3"));
    const pending = result.current.session.slots.length - 1;
    run((g) => g.revealSolution(null));
    expect(result.current.session.completed).toBe(true);
    expect(result.current.feedbackSlotId).toBeNull();
    expect(result.current.announcement.text).toBe(
      `Se muestra la solución de ${pending} casilleros. Ya podés finalizar.`,
    );
  });

  it("closes the feedback", () => {
    const { run, result } = setup();
    run((g) => g.drop("upload-store", "s3"));
    run((g) => g.closeFeedback());
    expect(result.current.feedbackSlotId).toBeNull();
  });

  it("fails fast without a session", () => {
    const store = createSessionStore();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useGameController(store, names))).toThrow();
  });
});
