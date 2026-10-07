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

describe("doubleName", () => {
  it("joins both names", () => {
    expect(doubleName("Lugar del mundo", "Región de AWS")).toBe("Lugar del mundo (Región de AWS)");
  });
});
