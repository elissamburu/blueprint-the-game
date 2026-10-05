// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The preview around the game screen: which scenario it plays, the notice when the draft changes
// in the middle of a game, the summary in the same panel and that nothing is saved. The game screen
// itself is @blueprint/play, tested there and in the e2e; here it is a stub that records its props.
import {
  applyCommand,
  commands,
  createSession,
  slotNodes,
  type SessionState,
} from "@blueprint/game-engine";
import type { GameScreenProps } from "@blueprint/play";
import type { Scenario } from "@blueprint/scenario-schema";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pdfYaml, scenarioOf, serviceName, shared } from "../testing/content-fixture";
import { PreviewPanel } from "./PreviewPanel";
import { gameBundleOf } from "./studio-game-host";

const games = vi.hoisted(() => ({ props: [] as GameScreenProps[] }));
vi.mock("@blueprint/play/game-screen", () => ({
  default: (props: GameScreenProps) => {
    games.props.push(props);
    return <p data-testid="game">{props.scenario.title}</p>;
  },
}));

const lastGame = (): GameScreenProps => {
  const props = games.props.at(-1);
  if (props === undefined) throw new Error("no game screen");
  return props;
};

const bundle = gameBundleOf(shared);
const draft = scenarioOf(pdfYaml);
const retitled = scenarioOf(pdfYaml.replace(/^title: .*$/m, 'title: "Otro título"'));

let setItem: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  games.props = [];
  localStorage.clear();
  setItem = vi.spyOn(Storage.prototype, "setItem");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const start = async (scenario: Scenario = draft) => {
  const user = userEvent.setup();
  const view = render(<PreviewPanel draft={scenario} bundle={bundle} />);
  await user.click(screen.getByRole("button", { name: "Empezar partida" }));
  await screen.findByTestId("game");
  return { user, view };
};

/** Every slot with its first optimal answer: a green game. */
const greenSession = (scenario: Scenario): SessionState =>
  slotNodes(scenario).reduce(
    (session, node) => {
      const optimal = node.answers.find((a) => a.grade === "optimal");
      if (optimal === undefined) return session;
      return applyCommand(session, commands.placeService(node.id, optimal.service)).state;
    },
    createSession(scenario, shared.gameRules),
  );

describe("PreviewPanel", () => {
  it("plays the draft with the Studio's host, which saves nothing", async () => {
    await start();
    const game = lastGame();
    expect(game.scenario).toBe(draft);
    expect(game.bundle).toBe(bundle);
    expect(game.host.onStarted).toBeUndefined();
    expect(game.host.reportIssueUrl).toBeUndefined();
    expect(game.host.printHref).toBeUndefined();
    expect(screen.getByRole("status")).toHaveProperty("textContent", "");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("goes on with the game when the draft changes, and offers to restart with the new one", async () => {
    const { user, view } = await start();
    // The same draft (an edit of comments keeps the object): no notice.
    view.rerender(<PreviewPanel draft={draft} bundle={bundle} />);
    expect(screen.getByRole("status").textContent).toBe("");

    view.rerender(<PreviewPanel draft={retitled} bundle={bundle} />);
    const status = screen.getByRole("status");
    expect(
      within(status).getByText("El escenario cambió: reiniciá para jugar la versión nueva."),
    ).toBeTruthy();
    expect(within(status).getByRole("button", { name: "Reiniciar" })).toBeTruthy();
    expect(screen.getByTestId("game").textContent).toBe(draft.title);

    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(screen.getByTestId("game").textContent).toBe("Otro título");
    expect(lastGame().scenario).toBe(retitled);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("shows the result in the same panel, focused, with the grade of each slot", async () => {
    const { user } = await start();
    await act(() => lastGame().host.onFinish(greenSession(draft)));

    const title = screen.getByRole("heading", { level: 2, name: "Partida terminada" });
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.queryByTestId("game")).toBeNull();
    const slots = slotNodes(draft);
    const max = slots.length * shared.gameRules.scoring.firstTryGreen;
    expect(screen.getByText(`Puntaje: ${max} de ${max}`)).toBeTruthy();
    const items = within(screen.getByRole("list", { name: "Grado por casillero" })).getAllByRole(
      "listitem",
    );
    expect(items).toHaveLength(slots.length);
    for (const [index, item] of items.entries()) {
      const optimal = slots[index]?.answers.find((a) => a.grade === "optimal");
      expect(item.textContent).toContain(`Casillero ${index + 1}:`);
      expect(item.textContent).toContain("Óptimo");
      expect(item.textContent).toContain(serviceName(optimal?.service ?? ""));
    }
    expect(setItem).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(await screen.findByTestId("game")).toBeTruthy();
    expect(games.props.at(-1)?.scenario).toBe(draft);
  });

  it("leaves the game with the back arrow and gives the focus to «Empezar partida»", async () => {
    await start();
    act(() => lastGame().host.exit.onExit?.());
    const startButton = screen.getByRole("button", { name: "Empezar partida" });
    await waitFor(() => expect(document.activeElement).toBe(startButton));
    expect(screen.queryByTestId("game")).toBeNull();
  });

  it("has nothing to play while no version of the draft was valid", () => {
    render(<PreviewPanel draft={undefined} bundle={bundle} />);
    expect(screen.queryByRole("button", { name: "Empezar partida" })).toBeNull();
    expect(screen.getByText("Todavía no hay una versión válida del escenario.")).toBeTruthy();
  });
});
