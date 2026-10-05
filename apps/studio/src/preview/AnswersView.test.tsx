// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The answers view: every slot revealed with its optimal on the diagram, and under it the answers
// of each slot, in the order of their numbers, with exactly the SlotAnswers of the printable
// version. The board itself (React Flow) is tested in packages/diagram and the e2e; here it is a
// stub that records its props.
import type { DiagramProps } from "@blueprint/diagram";
import { numberedSlots, SlotAnswers } from "@blueprint/play";
import type { Service } from "@blueprint/scenario-schema";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfYaml, scenarioOf, serviceName, shared } from "../testing/content-fixture";
import AnswersView from "./AnswersView";

const boards = vi.hoisted(() => ({ props: [] as DiagramProps[] }));
vi.mock("@blueprint/diagram", () => ({
  Diagram: (props: DiagramProps) => {
    boards.props.push(props);
    return <div role="group" aria-label={props.label} />;
  },
}));

afterEach(() => {
  cleanup();
  boards.props = [];
});

const scenario = scenarioOf(pdfYaml);
const services = new Map<string, Service>(shared.catalog.map((s) => [s.id, s]));

/** Markup without the ids of useId, which differ between two renders. */
const markup = (element: Element): string =>
  element.innerHTML.replace(/ (id|aria-labelledby)="[^"]*"/g, "");

describe("AnswersView", () => {
  it("reveals the optimal of every slot on the diagram, with its grade and number", () => {
    render(<AnswersView scenario={scenario} shared={shared} />);
    const board = boards.props.at(-1);
    expect(board?.diagram).toBe(scenario.diagram);
    expect(board?.onSlotActivate).toBeUndefined();
    expect(
      screen.getByRole("group", {
        name: `Diagrama de «${scenario.title}» con las respuestas óptimas`,
      }),
    ).toBeTruthy();
    for (const { node, number } of numberedSlots(scenario)) {
      const optimal = node.answers.find((a) => a.grade === "optimal");
      expect(board?.slots?.[node.id]).toEqual({
        grade: "optimal",
        number,
        serviceId: optimal?.service,
      });
    }
  });

  it("lists each slot in the order of its number with the same SlotAnswers as the printable version", () => {
    const { container } = render(<AnswersView scenario={scenario} shared={shared} />);
    const titles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    const slots = numberedSlots(scenario);
    expect(titles).toEqual(
      slots.map(
        ({ node, number }) => `Casillero ${number}: ${node.role.trim().replace(/\.+$/, "")}`,
      ),
    );

    for (const { node, number } of slots) {
      const section = container.querySelector(`[data-slot-number="${number}"]`);
      if (section === null) throw new Error(`no slot ${number}`);
      const answers = section.cloneNode(true) as Element;
      answers.querySelector("h3")?.remove();
      const alone = render(<SlotAnswers node={node} scenario={scenario} services={services} />);
      expect(markup(answers)).toBe(markup(alone.container));
      alone.unmount();
    }
  });

  it("names every answer of the YAML, grade by grade", () => {
    render(<AnswersView scenario={scenario} shared={shared} />);
    for (const { node } of numberedSlots(scenario)) {
      for (const answer of [...node.answers, ...node.incorrect]) {
        expect(screen.getAllByText(serviceName(answer.service)).length).toBeGreaterThan(0);
      }
    }
  });
});
