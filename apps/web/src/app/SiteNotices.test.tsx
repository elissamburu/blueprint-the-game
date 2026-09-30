// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import "../i18n";
import {
  BETA_NOTICE_DISMISSED_KEY,
  NARROW_NOTICE_DISMISSED_KEY,
} from "../features/play/ui-preferences";
import { SiteNotices } from "./SiteNotices";

const BETA = "Aviso de versión beta";
const NARROW = "Aviso de pantalla angosta";

const renderNotices = () =>
  render(
    <>
      <SiteNotices focusTargetId="contenido" />
      <main id="contenido" tabIndex={-1} />
    </>,
  );

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("beta notice", () => {
  it("is a named region with the beta text and the feedback link, and no live region", () => {
    const { container } = renderNotices();
    const notice = screen.getByRole("region", { name: BETA });
    expect(notice.textContent).toContain(
      "Estás probando una versión beta. Tu progreso se guarda solo en este navegador.",
    );
    const link = within(notice).getByRole("link", { name: /^Contanos qué te pareció/ });
    // Without VITE_FEEDBACK_URL: the feedback issue form of the repository.
    expect(link.getAttribute("href")).toBe(
      "https://github.com/elissamburu/blueprint-the-game/issues/new?template=feedback-beta.yml",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toContain("(se abre en otra pestaña)");
    // Nothing is announced on load.
    expect(container.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
  });

  it("closes, remembers it in this browser and moves the focus to the content", () => {
    const { unmount } = renderNotices();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar el aviso de versión beta" }));
    expect(screen.queryByRole("region", { name: BETA })).toBeNull();
    expect(localStorage.getItem(BETA_NOTICE_DISMISSED_KEY)).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("main"));
    // The other notice is a preference of its own.
    expect(screen.getByRole("region", { name: NARROW })).toBeTruthy();
    unmount();

    renderNotices();
    expect(screen.queryByRole("region", { name: BETA })).toBeNull();
  });
});

describe("narrow screen notice", () => {
  it("says the game is meant for desktop for now and can be closed", () => {
    renderNotices();
    const notice = screen.getByRole("region", { name: NARROW });
    expect(notice.textContent).toContain(
      "Por ahora Blueprint está pensado para pantallas de escritorio. El modo para celular llega más adelante.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar el aviso de pantalla angosta" }));
    expect(screen.queryByRole("region", { name: NARROW })).toBeNull();
    expect(localStorage.getItem(NARROW_NOTICE_DISMISSED_KEY)).toBe("true");
    expect(screen.getByRole("region", { name: BETA })).toBeTruthy();
  });
});
