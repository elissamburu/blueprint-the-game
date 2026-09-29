// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlayerProgress } from "@blueprint/game-engine";
import { describe, expect, it } from "vitest";
import type { ProgressLoad, ProgressRepository } from "./progress-repository";
import { createProgressStore } from "./progress-store";

const progress: PlayerProgress = {
  experience: "beginner",
  xp: 0,
  best: {},
  unlocked: [{ area: "serverless", level: 100 }],
};

const fakeRepository = (load: ProgressLoad, saveFails = false) => {
  const saved: PlayerProgress[] = [];
  const repository: ProgressRepository = {
    load: () => Promise.resolve(load),
    save: (p) => {
      if (saveFails) return Promise.reject(new Error("quota"));
      saved.push(p);
      return Promise.resolve();
    },
    clear: () => Promise.resolve(),
  };
  return { repository, saved };
};

describe("progress store", () => {
  it("hydrates the stored progress", async () => {
    const store = createProgressStore(fakeRepository({ status: "loaded", progress }).repository);
    expect(store.getState().status).toBe("idle");
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({ status: "ready", progress, notice: null });
  });

  it("starts without progress and with a notice when the stored data was discarded", async () => {
    const { repository } = fakeRepository({ status: "discarded", reason: "not valid JSON" });
    const store = createProgressStore(repository);
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({
      status: "ready",
      progress: null,
      notice: "discarded",
    });
    store.getState().dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  it("saves the progress it is given", async () => {
    const { repository, saved } = fakeRepository({ status: "empty" });
    const store = createProgressStore(repository);
    await store.getState().replace(progress);
    expect(saved).toEqual([progress]);
    expect(store.getState().progress).toBe(progress);
  });

  it("keeps playing in memory and raises a notice when saving fails", async () => {
    const store = createProgressStore(fakeRepository({ status: "empty" }, true).repository);
    await store.getState().replace(progress);
    expect(store.getState()).toMatchObject({ progress, notice: "save-failed" });
  });
});
