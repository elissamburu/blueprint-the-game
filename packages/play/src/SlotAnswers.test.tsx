// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { slotNodes, slotNumbers } from "@blueprint/game-engine";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { numberedSlots, SlotAnswers } from "./SlotAnswers";
import { pdfScenario, services, slotOf } from "./testing/game-fixture";

afterEach(cleanup);

const name = (id: string) => services.get(id)?.name ?? id;

describe("numberedSlots", () => {
  it("lists every slot once, in the order of its number", () => {
    const numbers = slotNumbers(pdfScenario);
    const slots = numberedSlots(pdfScenario);
    expect(slots.map((s) => s.number)).toEqual(slots.map((_, i) => i + 1));
    expect(slots.map((s) => s.node.id).sort()).toEqual(
      slotNodes(pdfScenario)
        .map((n) => n.id)
        .sort(),
    );
    for (const { node, number } of slots) expect(numbers.get(node.id)).toBe(number);
  });
});

describe("SlotAnswers", () => {
  const [first] = numberedSlots(pdfScenario);
  if (first === undefined) throw new Error("scenario without slots");
  const node = slotOf(pdfScenario, first.node.id);

  it("groups the optimal, acceptable and incorrect answers under h4 headings, in that order", () => {
    render(<SlotAnswers node={node} scenario={pdfScenario} services={services} />);
    const headings = screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent);
    const expected = [
      node.answers.some((a) => a.grade === "optimal") && "Óptimo",
      node.answers.some((a) => a.grade === "acceptable") && "Aceptables",
      node.incorrect.length > 0 && "Incorrectos típicos",
    ].filter(Boolean);
    expect(headings).toEqual(expected);

    const listed = screen
      .getAllByRole("list")
      .filter((list) => list.hasAttribute("aria-labelledby"))
      .flatMap((list) =>
        within(list)
          .getAllByRole("listitem")
          .filter((li) => li.parentElement === list),
      )
      .map((li) => [li.dataset.grade, li.querySelector("strong")?.textContent]);
    expect(listed).toEqual([
      ...node.answers.filter((a) => a.grade === "optimal").map((a) => ["optimal", name(a.service)]),
      ...node.answers
        .filter((a) => a.grade === "acceptable")
        .map((a) => ["acceptable", name(a.service)]),
      ...node.incorrect.map((i) => ["incorrect", name(i.service)]),
    ]);
  });

  it("shows the grade as text, the objectives, why and the documentation as links", () => {
    render(<SlotAnswers node={node} scenario={pdfScenario} services={services} />);
    const optimal = node.answers.find((a) => a.grade === "optimal");
    if (optimal === undefined) throw new Error("slot without optimal");
    const item = screen.getByText(name(optimal.service)).closest("li") as HTMLElement;
    expect(within(item).getByText("Óptimo")).toBeTruthy();
    const objectives = within(item).getByRole("list", { name: "Objetivos" });
    const texts = optimal.objectives.map(
      (id) => pdfScenario.objectives.find((o) => o.id === id)?.text,
    );
    for (const text of texts) expect(objectives.textContent).toContain(text);
    expect(item.textContent).toContain("Por qué:");
    for (const url of optimal.references) {
      const link = within(item).getByRole("link", {
        // The sr-only text says it opens in another tab.
        name: `${url}(se abre en otra pestaña)`,
      });
      expect(link.getAttribute("href")).toBe(url);
      expect(link.getAttribute("target")).toBe("_blank");
    }
  });

  it("leaves out a group without answers", () => {
    const onlyOptimal = {
      ...node,
      answers: node.answers.filter((a) => a.grade === "optimal"),
      incorrect: [],
    };
    render(<SlotAnswers node={onlyOptimal} scenario={pdfScenario} services={services} />);
    expect(screen.getAllByRole("heading", { level: 4 }).map((h) => h.textContent)).toEqual([
      "Óptimo",
    ]);
  });
});
