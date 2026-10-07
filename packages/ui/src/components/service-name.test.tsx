// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { doubleName, ServiceName } from "./service-name";

afterEach(cleanup);

describe("ServiceName", () => {
  it("reads as «plain name (real name)», the parentheses only for screen readers", () => {
    render(
      <button type="button">
        <ServiceName
          plainName="Almacenamiento de archivos"
          name="Amazon S3"
          nameClassName="text-xs"
        />
      </button>,
    );
    const button = screen.getByRole("button", {
      name: "Almacenamiento de archivos (Amazon S3)",
    });
    const real = button.querySelector<HTMLElement>('[data-slot="service-name-real"]');
    expect(real?.classList).toContain("text-muted-foreground");
    expect(real?.classList).toContain("text-xs");
    // The parentheses are not visible: the visible real name is hidden from screen readers and
    // a visually hidden copy carries them.
    expect(real?.textContent).toBe("Amazon S3");
    expect(real?.getAttribute("aria-hidden")).toBe("true");
    expect(button.querySelector(".sr-only")?.textContent).toBe("(Amazon S3)");
  });
});

describe("ServiceName with an aside", () => {
  it("puts it on the real name's line and reads it after both names", () => {
    render(
      <button type="button">
        <ServiceName
          plainName="Almacenamiento de archivos"
          name="Amazon S3"
          aside={<span>En uso</span>}
        />
      </button>,
    );
    const button = screen.getByRole("button", {
      // jsdom joins the parts without the spaces a browser puts between blocks.
      name: /^Almacenamiento de archivos \(Amazon S3\) ?En uso$/,
    });
    const real = button.querySelector('[data-slot="service-name-real"]');
    expect(real?.parentElement?.textContent).toBe("Amazon S3En uso");
  });

  it("never cuts a name: it hyphenates it and, as a last resort, breaks it anywhere", () => {
    const { container } = render(<ServiceName plainName="Almacenamiento" name="Amazon S3" />);
    const root = container.querySelector<HTMLElement>('[data-slot="service-name"]');
    expect(root?.classList).toContain("hyphens-auto");
    expect(root?.classList).toContain("wrap-anywhere");
    expect(root?.className).not.toMatch(/truncate|line-clamp/);
  });
});

describe("doubleName", () => {
  it("joins both names", () => {
    expect(doubleName("Lugar del mundo", "Región de AWS")).toBe("Lugar del mundo (Región de AWS)");
  });
});
