// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LevelBadge, type ScenarioLevel } from "./level-badge";

afterEach(cleanup);

const renderBadge = (level: ScenarioLevel, variant?: "solid" | "outline") => {
  const { container } = render(
    variant === undefined ? (
      <LevelBadge level={level} />
    ) : (
      <LevelBadge level={level} variant={variant} />
    ),
  );
  const badge = container.querySelector<HTMLElement>('[data-slot="level-badge"]');
  if (badge === null) throw new Error("LevelBadge not rendered");
  return badge;
};

describe("LevelBadge", () => {
  it.each<ScenarioLevel>([100, 200, 300, 400])("level %i → accessible text “Nivel %i”", (level) => {
    const badge = renderBadge(level);
    expect(badge.textContent).toBe(`Nivel ${level}`);
    expect(badge.dataset.level).toBe(String(level));
  });

  it("is outlined by default and solid on request", () => {
    expect(renderBadge(200).classList).toContain("bg-card");
    expect(renderBadge(200, "solid").classList).toContain("bg-primary");
  });
});
