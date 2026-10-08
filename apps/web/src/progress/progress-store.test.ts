// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlayerProgress } from "@blueprint/game-engine";
import { describe, expect, it, vi } from "vitest";
import type { ProgressLoad, ProgressRepository } from "./progress-repository";
import { createProgressStore } from "./progress-store";

const progress: PlayerProgress = {
  experience: "beginner",
  interests: ["serverless"],
  xp: 0,
  best: {},
  unlocked: [{ area: "serverless", level: 100 }],
  started: [],
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

  it("keeps the progress in memory only when the stored one is from a newer version", async () => {
    let cleared = false;
    const { repository, saved } = fakeRepository({ status: "incompatible", storedVersion: 2 });
    const store = createProgressStore({
      ...repository,
      clear: () => {
        cleared = true;
        return Promise.resolve();
      },
    });
    await store.getState().hydrate();
    expect(store.getState()).toMatchObject({
      status: "ready",
      progress: null,
      incompatible: true,
      notice: null,
    });
    await store.getState().replace(progress);
    await store.getState().reset();
    expect(saved).toEqual([]);
    expect(cleared).toBe(false);
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

describe("progress store reset", () => {
  it("forgets every game in progress with the progress (RF-PLAY-18)", async () => {
    const attempts = { load: () => null, save: vi.fn(), clear: vi.fn(), clearAll: vi.fn() };
    const store = createProgressStore(
      fakeRepository({ status: "loaded", progress }).repository,
      attempts,
    );
    await store.getState().hydrate();
    await store.getState().reset();
    expect(attempts.clearAll).toHaveBeenCalledOnce();
  });
});

describe("progress store switchTo (ADR-0029)", () => {
  it("reads the progress of the new backend and uses its games in progress", async () => {
    const store = createProgressStore(fakeRepository({ status: "empty" }).repository);
    await store.getState().hydrate();
    const attempts = { load: () => null, save: vi.fn(), clear: vi.fn(), clearAll: vi.fn() };
    await store.getState().switchTo({
      progress: fakeRepository({ status: "loaded", progress }).repository,
      attempts,
    });
    expect(store.getState()).toMatchObject({ status: "ready", progress });
    expect(store.getState().attempts).toBe(attempts);
  });

  it("ignores a read of the previous backend that ends after the switch", async () => {
    let finishLocal: (load: ProgressLoad) => void = () => undefined;
    const slow = fakeRepository({ status: "empty" }).repository;
    slow.load = () => new Promise<ProgressLoad>((resolve) => (finishLocal = resolve));
    const store = createProgressStore(slow);
    const localRead = store.getState().hydrate();
    await store.getState().switchTo({
      progress: fakeRepository({ status: "loaded", progress }).repository,
      attempts: { load: () => null, save: vi.fn(), clear: vi.fn(), clearAll: vi.fn() },
    });
    finishLocal({ status: "empty" });
    await localRead;
    expect(store.getState().progress).toBe(progress);
  });

  it("saves to the new backend after the switch", async () => {
    const before = fakeRepository({ status: "empty" });
    const after = fakeRepository({ status: "empty" });
    const store = createProgressStore(before.repository);
    await store.getState().switchTo({
      progress: after.repository,
      attempts: { load: () => null, save: vi.fn(), clear: vi.fn(), clearAll: vi.fn() },
    });
    await store.getState().replace(progress);
    expect(before.saved).toEqual([]);
    expect(after.saved).toEqual([progress]);
  });
});
