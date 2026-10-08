// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlayerProgress, SavedAttempt } from "@blueprint/game-engine";
import { describe, expect, it, vi } from "vitest";
import type { ProgressLoad, ProgressRepository } from "../../progress/progress-repository";
import { newProgress } from "../../testing/progress-fixture";
import type { CloudStore } from "../session";
import { MemoryTable } from "../testing/memory-table";
import { CloudAttemptStore, connectCloud } from "./cloud-backend";
import { ATTEMPT_SK_PREFIX, PROFILE_SK, TableCloudStore } from "./table-cloud-store";

const game = (scenarioId: string): SavedAttempt => ({ scenarioId, version: 1, commands: [] });

const localRepository = (load: ProgressLoad): ProgressRepository => ({
  load: () => Promise.resolve(load),
  save: vi.fn(() => Promise.resolve()),
  clear: vi.fn(() => Promise.resolve()),
});

const cloudWith = async (progress: PlayerProgress | null) => {
  const table = new MemoryTable();
  const store = new TableCloudStore(table);
  if (progress !== null) await store.saveProgress(progress);
  return { table, store: new TableCloudStore(table) };
};

describe("connectCloud: signing in (ADR-0029)", () => {
  it("uploads this browser's progress and games to an empty profile", async () => {
    const guest = { ...newProgress("beginner"), xp: 40 };
    const { table, store } = await cloudWith(null);
    const connected = await connectCloud(store, {
      progress: localRepository({ status: "loaded", progress: guest }),
      attempts: () => [game("club-photos")],
    });
    expect(connected.uploaded).toBe(true);
    expect(table.items.get(PROFILE_SK)).toMatchObject({ xp: 40 });
    expect(table.items.has(`${ATTEMPT_SK_PREFIX}club-photos`)).toBe(true);
    expect(await connected.backend.progress.load()).toEqual({ status: "loaded", progress: guest });
    expect(connected.backend.attempts.load("club-photos")).toEqual(game("club-photos"));
  });

  it("creates an empty profile when the guest has nothing to upload", async () => {
    const { table, store } = await cloudWith(null);
    const connected = await connectCloud(store, {
      progress: localRepository({ status: "empty" }),
      attempts: () => [],
    });
    expect(connected.uploaded).toBe(false);
    expect(table.items.get(PROFILE_SK)).toMatchObject({ xp: 0, completed: [] });
    expect(await connected.backend.progress.load()).toEqual({ status: "empty" });
  });

  it("uses the profile that already has progress, and uploads nothing", async () => {
    const cloud = { ...newProgress("architect"), xp: 900 };
    const { table, store } = await cloudWith(cloud);
    const connected = await connectCloud(store, {
      progress: localRepository({ status: "loaded", progress: newProgress("beginner") }),
      attempts: () => [game("club-photos")],
    });
    expect(connected.uploaded).toBe(false);
    expect(await connected.backend.progress.load()).toEqual({ status: "loaded", progress: cloud });
    expect(table.items.has(`${ATTEMPT_SK_PREFIX}club-photos`)).toBe(false);
  });

  it("saves to and clears the cloud profile", async () => {
    const { table, store } = await cloudWith(newProgress("beginner"));
    const { backend } = await connectCloud(store, {
      progress: localRepository({ status: "empty" }),
      attempts: () => [],
    });
    await backend.progress.save({ ...newProgress("beginner"), xp: 75 });
    expect(table.items.get(PROFILE_SK)).toMatchObject({ xp: 75 });
    await backend.progress.clear();
    expect(table.items.get(PROFILE_SK)).not.toHaveProperty("progress");
  });

  it("never overwrites a progress of a newer version of the game", async () => {
    const table = new MemoryTable();
    table.items.set(PROFILE_SK, {
      pk: table.pk,
      sk: PROFILE_SK,
      schemaVersion: 1,
      xp: 0,
      completed: [],
      progress: { schemaVersion: 999, progress: {} },
      createdAt: "2026-10-08T12:00:00.000Z",
      updatedAt: "2026-10-08T12:00:00.000Z",
    });
    const { backend } = await connectCloud(new TableCloudStore(table), {
      progress: localRepository({ status: "empty" }),
      attempts: () => [],
    });
    await expect(backend.progress.save(newProgress("beginner"))).rejects.toThrow();
    await backend.progress.clear();
    expect(table.items.get(PROFILE_SK)).toMatchObject({ progress: { schemaVersion: 999 } });
  });
});

describe("CloudAttemptStore", () => {
  it("answers from memory and writes every change in order", async () => {
    const table = new MemoryTable();
    const attempts = new CloudAttemptStore(new TableCloudStore(table), []);
    attempts.save(game("a"));
    attempts.save({ ...game("a"), version: 2 });
    attempts.clear("a");
    attempts.save(game("b"));
    expect(attempts.load("a")).toBeNull();
    expect(attempts.load("b")).toEqual(game("b"));
    await attempts.flush();
    expect(table.log).toEqual([
      `put ${ATTEMPT_SK_PREFIX}a`,
      `put ${ATTEMPT_SK_PREFIX}a`,
      `delete ${ATTEMPT_SK_PREFIX}a`,
      `put ${ATTEMPT_SK_PREFIX}b`,
    ]);
    attempts.clearAll();
    await attempts.flush();
    expect(table.items.size).toBe(0);
  });

  it("goes on when a write fails, with a warning", async () => {
    const deleteAttempt = vi.fn(() => Promise.resolve());
    const store = {
      saveAttempt: vi.fn(() => Promise.reject(new Error("AccessDenied"))),
      deleteAttempt,
    } as unknown as CloudStore;
    const warn = vi.fn();
    const attempts = new CloudAttemptStore(store, [], warn);
    attempts.save(game("a"));
    attempts.clear("a");
    await attempts.flush();
    expect(warn).toHaveBeenCalledOnce();
    expect(deleteAttempt).toHaveBeenCalledWith("a");
  });
});
