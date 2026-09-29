// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { applyCommand, commands, type Command, type SessionState } from "@blueprint/game-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import "../../i18n";
import { FeedbackPanel } from "./FeedbackPanel";
import { newSession, pdfScenario, services, slotOf } from "./testing/game-fixture";

afterEach(cleanup);

const play = (...cmds: Command[]): SessionState =>
  cmds.reduce((state, command) => applyCommand(state, command).state, newSession());

const renderPanel = (session: SessionState, slotId: string | null) => {
  const onAccept = vi.fn();
  const onRetry = vi.fn();
  const onClose = vi.fn();
  render(
    <FeedbackPanel
      session={session}
      slotId={slotId}
      services={services}
      announcement={{ key: 1, text: "Anuncio de prueba." }}
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

describe("FeedbackPanel", () => {
  it("is a polite live region that invites to place a service while empty", () => {
    const { panel } = renderPanel(newSession(), null);
    expect(panel.getAttribute("aria-live")).toBe("polite");
    expect(panel.textContent).toContain("Colocá un servicio para ver la explicación.");
    expect(panel.textContent).toContain("Anuncio de prueba.");
    expect(screen.queryByRole("button")).toBeNull();
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
    expect(within(panel).getByRole("heading").textContent).toBe("IncorrectoAmazon EC2");
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
});
