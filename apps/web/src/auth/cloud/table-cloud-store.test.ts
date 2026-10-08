// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { SavedAttempt } from "@blueprint/game-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ATTEMPT_SCHEMA_VERSION } from "../../progress/local-storage-attempt-repository";
import { PROGRESS_SCHEMA_VERSION } from "../../progress/progress-schema";
import { newProgress } from "../../testing/progress-fixture";
import { IDENTITY_ID, MemoryTable } from "../testing/memory-table";
import { ATTEMPT_SK_PREFIX, PROFILE_SK, TableCloudStore } from "./table-cloud-store";

const NOW = "2026-10-08T12:00:00.000Z";
const game: SavedAttempt = {
  scenarioId: "club-photos",
  version: 1,
  commands: [{ type: "selectSlot", slotId: "s1" }],
};

let table: MemoryTable;
let warn: ReturnType<typeof vi.fn<(message: string) => void>>;
let store: TableCloudStore;

beforeEach(() => {
  table = new MemoryTable();
  warn = vi.fn<(message: string) => void>();
  store = new TableCloudStore(table, { now: () => NOW, warn });
});

describe("TableCloudStore profile", () => {
  it("reads an account without a profile as empty", async () => {
    expect(await store.loadProfile()).toEqual({ status: "empty" });
  });

  it("keeps the progress, with xp and completed as copies for whoever reads the table", async () => {
    const progress = {
      ...newProgress("aws-user"),
      xp: 120,
      best: {
        "club-photos": {
          version: 1,
          level: 100 as const,
          areas: ["serverless"],
          score: 3,
          maxScore: 3,
          xp: 120,
          hintsUsed: 0,
          perfect: true,
          allOptimal: true,
        },
      },
    };
    await store.saveProgress(progress);
    expect(table.items.get(PROFILE_SK)).toEqual({
      pk: IDENTITY_ID,
      sk: PROFILE_SK,
      schemaVersion: 1,
      xp: 120,
      completed: ["club-photos"],
      progress: { schemaVersion: PROGRESS_SCHEMA_VERSION, progress },
      createdAt: NOW,
      updatedAt: NOW,
    });
    const read = await new TableCloudStore(table, { now: () => NOW }).loadProfile();
    expect(read).toEqual({
      status: "loaded",
      info: { displayName: null },
      progress: { status: "loaded", progress },
    });
  });

  it("keeps the visible name with the progress, trimmed", async () => {
    await store.saveProgress(newProgress("beginner"));
    await store.saveDisplayName("  Ada  ");
    expect(table.items.get(PROFILE_SK)).toMatchObject({ displayName: "Ada" });
    expect(table.items.get(PROFILE_SK)).toHaveProperty("progress");
    const read = await new TableCloudStore(table).loadProfile();
    expect(read).toMatchObject({ status: "loaded", info: { displayName: "Ada" } });
  });

  it.each(["", "   ", "x".repeat(41)])("refuses the visible name %j", async (name) => {
    await expect(store.saveDisplayName(name)).rejects.toThrow();
    expect(table.items.size).toBe(0);
  });

  it("clears the progress but keeps the profile and its name", async () => {
    await store.saveProgress(newProgress("beginner"));
    await store.saveDisplayName("Ada");
    await store.clearProgress();
    const item = table.items.get(PROFILE_SK);
    expect(item).toMatchObject({ displayName: "Ada", xp: 0, completed: [] });
    expect(item).not.toHaveProperty("progress");
    expect(await new TableCloudStore(table).loadProfile()).toMatchObject({
      status: "loaded",
      progress: { status: "empty" },
    });
  });

  it("discards an unreadable profile, which the next save replaces", async () => {
    table.items.set(PROFILE_SK, { pk: IDENTITY_ID, sk: PROFILE_SK, schemaVersion: 1, xp: -5 });
    const read = await store.loadProfile();
    expect(read).toMatchObject({ status: "loaded", progress: { status: "discarded" } });
    expect(warn).toHaveBeenCalledOnce();
    await store.saveProgress(newProgress("beginner"));
    expect(await new TableCloudStore(table).loadProfile()).toMatchObject({
      progress: { status: "loaded" },
    });
  });

  it("discards a profile of another player", async () => {
    table.items.set(PROFILE_SK, {
      pk: "us-east-2:other",
      sk: PROFILE_SK,
      schemaVersion: 1,
      xp: 0,
      completed: [],
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await store.loadProfile()).toMatchObject({ progress: { status: "discarded" } });
  });

  it("discards a progress that does not validate, keeping the name", async () => {
    table.items.set(PROFILE_SK, {
      pk: IDENTITY_ID,
      sk: PROFILE_SK,
      schemaVersion: 1,
      displayName: "Ada",
      xp: 0,
      completed: [],
      progress: { schemaVersion: PROGRESS_SCHEMA_VERSION, progress: { xp: "mucho" } },
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await store.loadProfile()).toMatchObject({
      info: { displayName: "Ada" },
      progress: { status: "discarded" },
    });
  });

  it("leaves a progress of a newer version of the game untouched", async () => {
    table.items.set(PROFILE_SK, {
      pk: IDENTITY_ID,
      sk: PROFILE_SK,
      schemaVersion: 1,
      xp: 0,
      completed: [],
      progress: { schemaVersion: PROGRESS_SCHEMA_VERSION + 1, progress: {} },
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(await store.loadProfile()).toMatchObject({
      progress: { status: "incompatible", storedVersion: PROGRESS_SCHEMA_VERSION + 1 },
    });
  });
});

describe("TableCloudStore games in progress", () => {
  it("keeps one item per scenario and reads them back", async () => {
    await store.saveAttempt(game);
    expect(table.items.get(`${ATTEMPT_SK_PREFIX}club-photos`)).toEqual({
      pk: IDENTITY_ID,
      sk: `${ATTEMPT_SK_PREFIX}club-photos`,
      schemaVersion: ATTEMPT_SCHEMA_VERSION,
      attempt: game,
      updatedAt: NOW,
    });
    expect(await store.loadAttempts()).toEqual([game]);
    await store.deleteAttempt("club-photos");
    expect(await store.loadAttempts()).toEqual([]);
  });

  it("skips a game that does not validate or whose key is not its scenario", async () => {
    await store.saveAttempt(game);
    table.items.set(`${ATTEMPT_SK_PREFIX}bad`, {
      pk: IDENTITY_ID,
      sk: `${ATTEMPT_SK_PREFIX}bad`,
      schemaVersion: ATTEMPT_SCHEMA_VERSION,
      attempt: { scenarioId: "bad", version: 0, commands: [] },
      updatedAt: NOW,
    });
    table.items.set(`${ATTEMPT_SK_PREFIX}moved`, {
      pk: IDENTITY_ID,
      sk: `${ATTEMPT_SK_PREFIX}moved`,
      schemaVersion: ATTEMPT_SCHEMA_VERSION,
      attempt: { ...game, scenarioId: "elsewhere" },
      updatedAt: NOW,
    });
    expect(await store.loadAttempts()).toEqual([game]);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("deletes every item of the player", async () => {
    await store.saveProgress(newProgress("beginner"));
    await store.saveAttempt(game);
    await store.deleteAll();
    expect(table.items.size).toBe(0);
  });
});
