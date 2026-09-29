// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RadioGroup } from "./radio-group";
import { RadioCardItem } from "./radio-card";

afterEach(cleanup);

const renderGroup = () =>
  render(
    <RadioGroup aria-label="Experiencia" defaultValue="aws-user">
      <RadioCardItem value="beginner" marker={1} title="Recién empiezo" description="Conceptos" />
      <RadioCardItem value="aws-user" marker={2} title="Uso AWS" description="Algunos proyectos" />
    </RadioGroup>,
  );

describe("RadioCardItem", () => {
  it("is a radio named by its title and described by its description, not by the marker", () => {
    renderGroup();
    const radio = screen.getByRole("radio", { name: "Uso AWS" });
    expect(radio.getAttribute("aria-checked")).toBe("true");
    const description = document.getElementById(radio.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toBe("Algunos proyectos");
    expect(screen.getByRole("radio", { name: "Recién empiezo" }).getAttribute("aria-checked")).toBe(
      "false",
    );
  });

  it("belongs to a radiogroup and changes the checked option on click", () => {
    renderGroup();
    expect(screen.getByRole("radiogroup", { name: "Experiencia" })).toBeDefined();
    const beginner = screen.getByRole("radio", { name: "Recién empiezo" });
    fireEvent.click(beginner);
    expect(beginner.getAttribute("aria-checked")).toBe("true");
    expect(beginner.dataset.state).toBe("checked");
  });

  it("omits aria-describedby without a description", () => {
    render(
      <RadioGroup aria-label="Nivel">
        <RadioCardItem value="100" marker={1} title="Nivel 100" />
      </RadioGroup>,
    );
    expect(screen.getByRole("radio", { name: "Nivel 100" }).hasAttribute("aria-describedby")).toBe(
      false,
    );
  });
});
