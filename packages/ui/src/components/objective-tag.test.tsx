// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ObjectiveTag, type ObjectiveStatus } from "./objective-tag";

afterEach(cleanup);

const renderTag = (status: ObjectiveStatus, text: string) => {
  const { container } = render(<ObjectiveTag status={status}>{text}</ObjectiveTag>);
  const tag = container.querySelector<HTMLElement>('[data-slot="objective-tag"]');
  if (tag === null) throw new Error("ObjectiveTag not rendered");
  return tag;
};

describe("ObjectiveTag", () => {
  it.each<[ObjectiveStatus, string, string]>([
    ["met", "Cumple: Tráfico esporádico", "text-success"],
    ["partial", "A medias: Ningún comprobante se pierde", "text-warning"],
    ["violated", "Viola: Sin servidores", "text-destructive"],
  ])("%s → accessible text %j", (status, accessibleText, colorClass) => {
    const objective = accessibleText.slice(accessibleText.indexOf(": ") + 2);
    const tag = renderTag(status, objective);
    expect(tag.textContent).toBe(accessibleText);
    expect(tag.classList).toContain(colorClass);
  });

  it("shows the prefix only for violated objectives; otherwise it is screen-reader only", () => {
    const prefixOf = (status: ObjectiveStatus) =>
      renderTag(status, "Objetivo").querySelector('[data-slot="objective-tag-prefix"]');
    expect(prefixOf("met")?.className).toBe("sr-only");
    expect(prefixOf("partial")?.className).toBe("sr-only");
    expect(prefixOf("violated")?.hasAttribute("class")).toBe(false);
  });

  it("uses a distinct decorative icon per status: check, dash and X", () => {
    const icons = (["met", "partial", "violated"] as const).map((status) => {
      const icon = renderTag(status, "Objetivo").querySelector("svg");
      expect(icon?.getAttribute("aria-hidden")).toBe("true");
      return icon?.getAttribute("class");
    });
    expect(icons.map((c) => c?.match(/lucide-(check|minus|x)\b/)?.[1])).toEqual([
      "check",
      "minus",
      "x",
    ]);
  });
});
