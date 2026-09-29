// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Content loaded at runtime: the bundle (index, catalog, game rules) once, and each scenario
// when it is opened. The status drives the loading and error screens.
import type { Scenario } from "@blueprint/scenario-schema";
import { create } from "zustand";
import {
  loadContentBundle,
  loadScenario,
  type ContentBundle,
  type ContentLoadError,
  type LoadOptions,
} from "./load-bundle";

export type ScenarioLookup =
  | { readonly status: "ready"; readonly scenario: Scenario }
  /** Not in the listing: unknown id, retired, or a draft outside development. */
  | { readonly status: "not-found" }
  | { readonly status: "error"; readonly error: ContentLoadError };

export interface ContentState {
  readonly status: "idle" | "loading" | "ready" | "error";
  readonly bundle: ContentBundle | null;
  readonly error: ContentLoadError | null;
  /** Loads the bundle once; after an error, calling it again retries. */
  load: () => Promise<void>;
  /** Loads (once) the scenario of a listed entry. Needs the bundle loaded. */
  loadScenario: (id: string) => Promise<ScenarioLookup>;
}

export const createContentStore = (options: LoadOptions) =>
  create<ContentState>()((set, get) => {
    const scenarios = new Map<string, Promise<ScenarioLookup>>();
    return {
      status: "idle",
      bundle: null,
      error: null,
      load: async () => {
        const { status } = get();
        if (status === "loading" || status === "ready") return;
        set({ status: "loading", error: null });
        const result = await loadContentBundle(options);
        set(
          result.ok
            ? { status: "ready", bundle: result.value }
            : { status: "error", error: result.error },
        );
      },
      loadScenario: (id) => {
        const entry = get().bundle?.index.scenarios.find((s) => s.id === id);
        if (entry === undefined) return Promise.resolve({ status: "not-found" });
        const cached = scenarios.get(entry.file);
        if (cached !== undefined) return cached;
        const pending = loadScenario(entry, options).then((result): ScenarioLookup => {
          // Failures are not cached, so opening the scenario again retries.
          if (!result.ok) scenarios.delete(entry.file);
          return result.ok
            ? { status: "ready", scenario: result.value }
            : { status: "error", error: result.error };
        });
        scenarios.set(entry.file, pending);
        return pending;
      },
    };
  });

export const useContentStore = createContentStore({
  baseUrl: `${import.meta.env.BASE_URL}content/`,
  fetch: (input, init) => fetch(input, init),
  includeDrafts: import.meta.env.DEV,
});
