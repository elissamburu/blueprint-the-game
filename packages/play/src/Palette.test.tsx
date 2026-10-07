// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The level 0 card of the palette (RF-PAL-06): plain name first, accessible name with both names,
// the same text in the tooltip and the aria-label of the collapsed palette, search by plain name,
// and concepts drawn with their glyph or initials. Outside level 0 the card does not change.
import type { Service } from "@blueprint/scenario-schema";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ServiceDndContext } from "./interaction/drag";
import { Palette } from "./Palette";
import { bundle, levelZeroServices } from "./testing/game-fixture";

afterEach(cleanup);

const CATEGORIES = bundle.catalog.categories;
const IDS = ["s3", "lambda", "region", "pay-as-you-go"];

const renderPalette = ({
  plainNames,
  collapsed = false,
  catalog = levelZeroServices,
  placed = [],
}: {
  plainNames?: boolean;
  collapsed?: boolean;
  catalog?: ReadonlyMap<string, Service>;
  placed?: string[];
}) => {
  const iconSrc = vi.fn((id: string) => `/icons/${id}.svg`);
  render(
    <ServiceDndContext serviceName={(id) => id} slotRole={(id) => id} renderOverlay={() => null}>
      <Palette
        serviceIds={IDS}
        catalog={catalog}
        iconSrc={iconSrc}
        categories={CATEGORIES}
        placed={new Set(placed)}
        pendingServiceId={null}
        targetRole={null}
        onChoose={vi.fn()}
        collapsed={collapsed}
        onCollapsedChange={vi.fn()}
        {...(plainNames === undefined ? {} : { plainNames })}
      />
    </ServiceDndContext>,
  );
  return { iconSrc };
};

const card = (id: string) => {
  const button = document.querySelector<HTMLElement>(`[data-palette-service="${id}"]`);
  if (button === null) throw new Error(`no card ${id}`);
  return button;
};

describe("Palette at level 0", () => {
  it("shows the plain name on top and the real name below, smaller and muted", () => {
    renderPalette({ plainNames: true });
    const s3 = screen.getByRole("button", { name: "Almacenamiento de archivos (Amazon S3)" });
    expect(s3.querySelector('[data-slot="service-name-plain"]')?.textContent).toBe(
      "Almacenamiento de archivos",
    );
    const real = s3.querySelector<HTMLElement>('[data-slot="service-name-real"]');
    expect(real?.textContent).toBe("Amazon S3");
    expect(real?.classList).toContain("text-xs");
    expect(real?.classList).toContain("text-muted-foreground");
    screen.getByRole("button", { name: "Lugar del mundo (Región de AWS)" });
  });

  it("keeps «En uso» after both names of a placed card", () => {
    renderPalette({ plainNames: true, placed: ["s3"] });
    // jsdom has no layout: the flex items are not split by a space as in a browser.
    screen.getByRole("button", { name: /^Almacenamiento de archivos \(Amazon S3\) ?En uso$/ });
  });

  it("collapsed: the tooltip and the aria-label are the same text", async () => {
    const user = userEvent.setup();
    renderPalette({ plainNames: true, collapsed: true, placed: ["lambda"] });
    const s3 = card("s3");
    expect(s3.getAttribute("aria-label")).toBe("Almacenamiento de archivos (Amazon S3)");
    await user.hover(s3);
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Almacenamiento de archivos (Amazon S3)",
    );
    expect(card("lambda").getAttribute("aria-label")).toBe(
      "Función que corre sola (AWS Lambda) (en uso)",
    );
  });

  it("finds a card by its plain name, ignoring case and accents", async () => {
    const user = userEvent.setup();
    renderPalette({ plainNames: true });
    await user.type(screen.getByRole("searchbox"), "FUNCION que");
    const results = document.querySelectorAll("[data-palette-service]");
    expect([...results].map((b) => b.getAttribute("data-palette-service"))).toEqual(["lambda"]);
  });

  it("draws a concept with its glyph or its initials, never asking for its icon", () => {
    const { iconSrc } = renderPalette({ plainNames: true });
    expect(card("region").querySelector("[data-glyph=region] svg")).not.toBeNull();
    const pay = card("pay-as-you-go").querySelector<HTMLElement>("[data-slot=service-icon]");
    expect(pay?.hasAttribute("data-fallback")).toBe(true);
    expect(pay?.textContent).toBe("PPU");
    expect(iconSrc.mock.calls.map(([id]) => id).sort()).toEqual(["lambda", "s3"]);
  });
});

describe("Palette outside level 0", () => {
  it("shows and names each card by its name only, as always", () => {
    renderPalette({});
    const s3 = screen.getByRole("button", { name: "Amazon S3" });
    expect(s3.querySelector('[data-slot="service-name"]')).toBeNull();
    expect(within(s3).queryByText("Almacenamiento de archivos")).toBeNull();
  });

  it("does not search by plain name", async () => {
    const user = userEvent.setup();
    renderPalette({ plainNames: false });
    await user.type(screen.getByRole("searchbox"), "almacenamiento de archivos");
    expect(document.querySelectorAll("[data-palette-service]")).toHaveLength(0);
  });

  it("collapsed: names the card by its name", () => {
    renderPalette({ collapsed: true });
    expect(card("s3").getAttribute("aria-label")).toBe("Amazon S3");
  });
});
