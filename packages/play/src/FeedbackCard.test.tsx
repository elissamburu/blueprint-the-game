// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { applyCommand, commands, type Command, type SessionState } from "@blueprint/game-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FeedbackCard, hasFeedback } from "./FeedbackCard";
import {
  levelZeroScenario,
  levelZeroServices,
  newSession,
  pdfScenario,
  S3_ANALOGY_LIMIT,
  services,
  slotOf,
} from "./testing/game-fixture";

afterEach(cleanup);

const play = (...cmds: Command[]): SessionState =>
  cmds.reduce((state, command) => applyCommand(state, command).state, newSession());

const renderPanel = (session: SessionState, slotId: string | null) => {
  const onAccept = vi.fn();
  const onRetry = vi.fn();
  const onClose = vi.fn();
  render(
    <FeedbackCard
      session={session}
      slotId={slotId}
      services={services}
      onAccept={onAccept}
      onRetry={onRetry}
      onClose={onClose}
    />,
  );
  const panel = document.querySelector("section");
  if (panel === null) throw new Error("no panel");
  return { panel, onAccept, onRetry, onClose };
};

const tags = (panel: HTMLElement) =>
  [...panel.querySelectorAll<HTMLElement>("[data-slot=objective-tag]")].map(
    (tag) => `${tag.dataset.status}: ${tag.textContent}`,
  );

describe("FeedbackCard", () => {
  it("renders nothing while there is nothing to explain", () => {
    const empty = newSession();
    render(
      <FeedbackCard
        session={empty}
        slotId="api-entry"
        services={services}
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(document.querySelector("section")).toBeNull();
    expect(hasFeedback(empty, "api-entry")).toBe(false);
    expect(hasFeedback(play(commands.placeService("api-entry", "alb")), "api-entry")).toBe(true);
    expect(hasFeedback(empty, null)).toBe(false);
  });

  it("optimal: rationale, met objectives, docs link and no actions", () => {
    const { panel } = renderPanel(
      play(commands.placeService("api-entry", "apigateway")),
      "api-entry",
    );
    expect(panel.dataset.status).toBe("optimal");
    expect(within(panel).getByRole("heading").textContent).toBe("ÓptimoAmazon API Gateway");
    expect(panel.textContent).toContain("cobra por pedido");
    expect(tags(panel)).toEqual([
      "met: Cumple: No administrar servidores, sistemas operativos ni parches.",
      "met: Cumple: Picos fuertes a fin de mes y días enteros sin uso.",
      "met: Cumple: Pagar lo mínimo posible cuando no hay actividad.",
    ]);
    const docs = within(panel).getByRole("link", { name: /^Documentación/ });
    expect(docs.getAttribute("href")).toBe(
      "https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html",
    );
    expect(
      within(panel)
        .getAllByRole("button")
        .map((b) => b.textContent),
    ).toEqual([""]);
  });

  it('acceptable: half-met goals, "Me quedo con esta" and "Probar otra"', async () => {
    const user = userEvent.setup();
    const { panel, onAccept, onRetry } = renderPanel(
      play(commands.placeService("api-entry", "alb")),
      "api-entry",
    );
    expect(panel.dataset.status).toBe("acceptable");
    expect(tags(panel)).toEqual([
      "partial: A medias: Picos fuertes a fin de mes y días enteros sin uso.",
      "partial: A medias: Pagar lo mínimo posible cuando no hay actividad.",
    ]);
    await user.click(within(panel).getByRole("button", { name: "Me quedo con esta" }));
    expect(onAccept).toHaveBeenCalledWith("api-entry");
    await user.click(within(panel).getByRole("button", { name: "Probar otra" }));
    expect(onRetry).toHaveBeenCalledWith("api-entry");
  });

  it('accepted: says so and only offers "Probar otra"', () => {
    const { panel } = renderPanel(
      play(commands.placeService("api-entry", "alb"), commands.acceptAcceptable("api-entry")),
      "api-entry",
    );
    expect(panel.dataset.status).toBe("accepted");
    expect(panel.textContent).toContain("Te quedaste con esta");
    expect(within(panel).queryByRole("button", { name: "Me quedo con esta" })).toBeNull();
    expect(within(panel).getByRole("button", { name: "Probar otra" })).toBeTruthy();
  });

  it('incorrect: specific rationale, "Viola: <restricción>" and "Probar otra", no docs', () => {
    const { panel } = renderPanel(play(commands.placeService("api-entry", "ec2")), "api-entry");
    expect(panel.dataset.status).toBe("incorrect");
    // RF-EVAL-07: the title uses the full name of the catalog when there is one.
    expect(within(panel).getByRole("heading").textContent).toBe(
      "IncorrectoAmazon Elastic Compute Cloud",
    );
    expect(tags(panel)).toEqual([
      "violated: Viola: No administrar servidores, sistemas operativos ni parches.",
    ]);
    expect(within(panel).getByRole("button", { name: "Probar otra" })).toBeTruthy();
    expect(within(panel).queryByRole("button", { name: "Me quedo con esta" })).toBeNull();
    expect(within(panel).queryByRole("link")).toBeNull();
  });

  it("undeclared: generic explanation from the catalog and the role, no objectives", () => {
    const { panel } = renderPanel(play(commands.placeService("api-entry", "s3")), "api-entry");
    expect(panel.dataset.status).toBe("incorrect");
    expect(panel.textContent).toContain(`${services.get("s3")?.short} No cumple el rol: `);
    expect(tags(panel)).toEqual([]);
  });

  it('with several references, one "Documentación" opens the list in a popover', async () => {
    const user = userEvent.setup();
    const { panel } = renderPanel(
      play(commands.placeService("url-signer", "lambda")),
      "url-signer",
    );
    const references = slotOf(pdfScenario, "url-signer").answers.find(
      (a) => a.service === "lambda",
    )?.references;
    expect(references?.length).toBeGreaterThan(1);
    expect(within(panel).queryByRole("link")).toBeNull();
    await user.click(within(panel).getByRole("button", { name: /^Documentación/ }));
    const list = await screen.findByRole("dialog", { name: "Documentación" });
    expect(
      within(list)
        .getAllByRole("link")
        .map((l) => l.getAttribute("href")),
    ).toEqual(references);
  });

  it("closes with the X button", async () => {
    const user = userEvent.setup();
    const { onClose } = renderPanel(
      play(commands.placeService("api-entry", "apigateway")),
      "api-entry",
    );
    await user.click(screen.getByRole("button", { name: "Cerrar explicación" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("motion (RF-PLAY-17)", () => {
    const placed = () => play(commands.placeService("api-entry", "apigateway"));
    const card = (props: { leaving?: boolean; reducedMotion?: boolean; onExited?: () => void }) =>
      render(
        <FeedbackCard
          session={placed()}
          slotId="api-entry"
          services={services}
          onAccept={() => {}}
          onRetry={() => {}}
          onClose={() => {}}
          {...props}
        />,
      ).container.querySelector("section");

    it("rises in, and while it leaves it sinks out and cannot be reached", () => {
      expect(card({})?.className).toMatch(/animate-in .*slide-in-from-bottom-\[12px\]/);
      cleanup();
      const onExited = vi.fn();
      const leaving = card({ leaving: true, onExited });
      expect(leaving?.className).toMatch(/animate-out .*slide-out-to-bottom-\[12px\]/);
      expect(leaving?.hasAttribute("inert")).toBe(true);
      expect(leaving?.getAttribute("aria-hidden")).toBe("true");
      expect(screen.queryByRole("region")).toBeNull();
      // React hears the end of a CSS animation in jsdom as webkitAnimationEnd.
      leaving?.dispatchEvent(new Event("webkitAnimationEnd", { bubbles: true }));
      expect(onExited).toHaveBeenCalledTimes(1);
    });

    it("with reduced motion only fades in and out", () => {
      for (const leaving of [false, true]) {
        const className = card({ leaving, reducedMotion: true })?.className ?? "";
        expect(className).toMatch(/fade-(in|out) duration-\(--motion-reduced-fade\)/);
        expect(className).not.toMatch(/slide-(in-from|out-to)-/);
        cleanup();
      }
    });
  });

  describe("revealed (RF-PLAY-14)", () => {
    /** The PDF scenario with a second optimal answer in api-entry (alb, acceptable in content). */
    const twoOptimal = {
      ...pdfScenario,
      diagram: {
        ...pdfScenario.diagram,
        nodes: pdfScenario.diagram.nodes.map((node) =>
          node.type === "slot" && node.id === "api-entry"
            ? {
                ...node,
                answers: node.answers.map((a) =>
                  a.service === "alb" ? { ...a, grade: "optimal" as const } : a,
                ),
              }
            : node,
        ),
      },
    };
    const reveal = (scenario = pdfScenario) =>
      applyCommand(newSession(scenario), commands.revealSolution("api-entry")).state;

    it("explains the first optimal answer as «Solución vista», without actions", () => {
      const { panel } = renderPanel(reveal(), "api-entry");
      expect(panel.dataset.status).toBe("revealed");
      expect(within(panel).getByRole("heading").textContent).toContain("Solución vista");
      expect(panel.textContent).toContain("No suma puntos");
      expect(panel.textContent).not.toMatch(/También (es|son) óptimo/);
      expect(within(panel).queryByRole("button", { name: "Probar otra" })).toBeNull();
    });

    it("names the other optimal answers when there is more than one", () => {
      const { panel } = renderPanel(reveal(twoOptimal), "api-entry");
      expect(panel.textContent).toContain("Amazon API Gateway");
      expect(panel.textContent).toContain(
        `También es óptimo: ${services.get("alb")?.name ?? "alb"}`,
      );
    });
  });
});

describe("FeedbackCard: full name and analogy limit (RF-EVAL-07)", () => {
  const renderLevelZero = (...cmds: Command[]) => {
    const session = cmds.reduce(
      (state, command) => applyCommand(state, command).state,
      newSession(levelZeroScenario),
    );
    render(
      <FeedbackCard
        session={session}
        slotId="upload-store"
        services={levelZeroServices}
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const panel = document.querySelector("section");
    if (panel === null) throw new Error("no panel");
    return panel;
  };

  it("names the service by its full name, not by its plain name, at level 0 too", () => {
    const panel = renderLevelZero(commands.placeService("upload-store", "s3"));
    const [title] = within(panel).getAllByRole("heading");
    expect(title?.textContent).toBe("ÓptimoAmazon Simple Storage Service");
  });

  it("shows where the analogy breaks below the explanation, with a label, icon and its links", () => {
    const panel = renderLevelZero(commands.placeService("upload-store", "s3"));
    const block = within(panel).getByRole("group", { name: "Dónde se rompe la analogía" });
    expect(within(block).getByRole("heading", { level: 3 }).querySelector("svg")).not.toBeNull();
    // The same inline markdown as the rationale: React elements, not raw HTML.
    expect(block.textContent).toContain("acá cada documento es un objeto con su clave.");
    expect(within(block).getByText("objeto").tagName).toBe("STRONG");
    // Two references: one link that opens the list, told apart from the rationale's own.
    const docs = within(block).getByRole("button", {
      // jsdom joins the sr-only text without the space a browser puts around it.
      name: /^Documentación ?sobre la analogía/,
    });
    expect(docs.textContent).toContain("2 enlaces");
    // After the explanation, before the objectives.
    const explanation = within(panel).getByText(/URLs prefirmadas/, { selector: "p" });
    expect(
      explanation.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Inside the card: the live region reads it with the grade, not as an announcement apart.
    expect(panel.contains(block)).toBe(true);
    expect(block.closest("[aria-live]")).toBeNull();
  });

  it("links a single reference directly", () => {
    const scenario = {
      ...levelZeroScenario,
      diagram: {
        ...levelZeroScenario.diagram,
        nodes: levelZeroScenario.diagram.nodes.map((node) =>
          node.type === "slot" && node.id === "upload-store"
            ? {
                ...node,
                answers: node.answers.map((a) =>
                  a.service === "s3"
                    ? {
                        ...a,
                        analogyLimit: {
                          text: "Texto",
                          references: [S3_ANALOGY_LIMIT.references[0]],
                        },
                      }
                    : a,
                ),
              }
            : node,
        ),
      },
    };
    render(
      <FeedbackCard
        session={
          applyCommand(newSession(scenario), commands.placeService("upload-store", "s3")).state
        }
        slotId="upload-store"
        services={levelZeroServices}
        onAccept={vi.fn()}
        onRetry={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", {
      name: /^Documentación ?sobre la analogía ?\(se abre en otra pestaña\)$/,
    });
    expect(link.getAttribute("href")).toBe(S3_ANALOGY_LIMIT.references[0]);
  });

  it("has no analogy block when the answer has no analogy limit", () => {
    const panel = renderLevelZero(commands.placeService("upload-store", "efs"));
    expect(panel.querySelector("[data-analogy-limit]")).toBeNull();
    expect(within(panel).queryByText("Dónde se rompe la analogía")).toBeNull();
  });
});
