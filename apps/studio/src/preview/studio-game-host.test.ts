// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { createSession } from "@blueprint/game-engine";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pdfYaml, scenarioOf, shared } from "../testing/content-fixture";
import { createStudioGameHost, gameBundleOf, studioIconSrc } from "./studio-game-host";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const options = () => ({ exitLabel: "Salir de la partida", onExit: vi.fn(), onFinish: vi.fn() });

describe("the Studio's GameHost", () => {
  it("saves no progress: no «en curso», and finishing only hands the session to the preview", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const opts = options();
    const host = createStudioGameHost(opts);
    const session = createSession(scenarioOf(pdfYaml), shared.gameRules);

    expect(host.onStarted).toBeUndefined();
    await host.onFinish(session);
    expect(opts.onFinish).toHaveBeenCalledExactlyOnceWith(session);
    expect(setItem).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("offers neither the issue link nor the printable version, and keeps the Studio's layout", () => {
    const host = createStudioGameHost(options());
    expect(host.reportIssueUrl).toBeUndefined();
    expect(host.printHref).toBeUndefined();
    expect(host.useLayout).toBeUndefined();
  });

  it("leaves the game with a button, not a route", () => {
    const opts = options();
    const host = createStudioGameHost(opts);
    expect(host.exit.href).toBeUndefined();
    expect(host.exit.label).toBe("Salir de la partida");
    host.exit.onExit?.();
    expect(opts.onExit).toHaveBeenCalledOnce();
  });

  it("takes the icons from /icons of the local server", () => {
    expect(studioIconSrc("s3")).toBe("/icons/s3.svg");
    expect(createStudioGameHost(options()).iconSrc("lambda")).toBe("/icons/lambda.svg");
  });
});

describe("gameBundleOf", () => {
  it("gives the game screen the catalog, the areas and the rules of the shared files", () => {
    const bundle = gameBundleOf(shared);
    expect(bundle.catalog.services).toBe(shared.catalog);
    expect(bundle.catalog.categories).toBe(shared.categories);
    expect(bundle.catalog.confusionGroups).toBe(shared.confusionGroups);
    expect(bundle.index.areas).toBe(shared.areas);
    expect(bundle.rules).toBe(shared.gameRules);
  });
});
