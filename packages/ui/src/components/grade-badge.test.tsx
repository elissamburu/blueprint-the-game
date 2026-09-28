// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GradeBadge, type SlotGrade } from "./grade-badge";

afterEach(cleanup);

const renderBadge = (grade: SlotGrade, variant?: "plain" | "soft") => {
  const { container } = render(
    variant === undefined ? (
      <GradeBadge grade={grade} />
    ) : (
      <GradeBadge grade={grade} variant={variant} />
    ),
  );
  const badge = container.querySelector<HTMLElement>('[data-slot="grade-badge"]');
  if (badge === null) throw new Error("GradeBadge not rendered");
  return badge;
};

describe("GradeBadge", () => {
  it.each<[SlotGrade, string, string]>([
    ["optimal", "Óptimo", "text-success"],
    ["acceptable", "Aceptable", "text-warning"],
    ["incorrect", "Incorrecto", "text-destructive"],
    ["empty", "Vacío", "text-muted-foreground"],
  ])("%s → accessible text %j, colored with %s", (grade, text, colorClass) => {
    const badge = renderBadge(grade);
    expect(badge.textContent).toBe(text);
    expect(badge.dataset.grade).toBe(grade);
    expect(badge.classList).toContain(colorClass);
  });

  it("pairs every grade with a decorative icon (color is not the only cue, RNF-02)", () => {
    const icons = (["optimal", "acceptable", "incorrect", "empty"] as const).map((grade) => {
      const icon = renderBadge(grade).querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      return icon?.getAttribute("class");
    });
    expect(new Set(icons).size).toBe(icons.length);
  });

  it("uses the grade's soft background only in the soft variant", () => {
    expect(renderBadge("acceptable").classList).not.toContain("bg-warning-soft");
    expect(renderBadge("acceptable", "soft").classList).toContain("bg-warning-soft");
  });
});
