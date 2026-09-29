// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlayerProgress } from "@blueprint/game-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
  type LocalStorageProgressRepositoryOptions,
} from "./local-storage-progress-repository";

class MemoryStorage implements Storage {
  readonly #items = new Map<string, string>();
  get length() {
    return this.#items.size;
  }
  clear() {
    this.#items.clear();
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#items.delete(key);
  }
  setItem(key: string, value: string) {
    this.#items.set(key, value);
  }
}

const progress: PlayerProgress = {
  experience: "aws-user",
  xp: 150,
  best: {
    "static-website-https": {
      version: 1,
      level: 100,
      areas: ["networking", "storage"],
      score: 350,
      maxScore: 400,
      xp: 150,
      hintsUsed: 1,
      perfect: false,
    },
  },
  unlocked: [
    { area: "networking", level: 100 },
    { area: "networking", level: 200 },
  ],
};

let storage: MemoryStorage;
let warn: ReturnType<typeof vi.fn<(message: string) => void>>;

const repository = (options: LocalStorageProgressRepositoryOptions = {}) =>
  new LocalStorageProgressRepository({ storage: () => storage, warn, ...options });

const store = (value: unknown) =>
  storage.setItem(PROGRESS_STORAGE_KEY, typeof value === "string" ? value : JSON.stringify(value));

const stored = (): unknown => JSON.parse(storage.getItem(PROGRESS_STORAGE_KEY) ?? "null");

beforeEach(() => {
  storage = new MemoryStorage();
  warn = vi.fn<(message: string) => void>();
});

describe("LocalStorageProgressRepository", () => {
  it("returns empty on a first visit", async () => {
    expect(await repository().load()).toEqual({ status: "empty" });
  });

  it("saves the progress with its schemaVersion and reads it back", async () => {
    await repository().save(progress);
    expect(stored()).toEqual({ schemaVersion: 1, progress });
    expect(await repository().load()).toEqual({ status: "loaded", progress });
  });

  it("clears the stored progress", async () => {
    await repository().save(progress);
    await repository().clear();
    expect(await repository().load()).toEqual({ status: "empty" });
  });

  describe("corrupt data", () => {
    it.each([
      ["text that is not JSON", "{not json"],
      ["data without an envelope", { xp: 10 }],
      [
        "an unknown experience",
        { schemaVersion: 1, progress: { ...progress, experience: "guru" } },
      ],
      ["negative XP", { schemaVersion: 1, progress: { ...progress, xp: -1 } }],
      [
        "an invalid level",
        { schemaVersion: 1, progress: { ...progress, unlocked: [{ area: "x", level: 150 }] } },
      ],
      ["unknown fields", { schemaVersion: 1, progress: { ...progress, streak: 4 } }],
      ["a version newer than the app", { schemaVersion: 99, progress }],
    ])("discards %s with a warning and removes it", async (_case, value) => {
      store(value);
      const result = await repository().load();
      expect(result.status).toBe("discarded");
      expect(warn).toHaveBeenCalledOnce();
      expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
      // The next visit starts clean, without warning again.
      expect(await repository().load()).toEqual({ status: "empty" });
      expect(warn).toHaveBeenCalledOnce();
    });
  });

  describe("migrations", () => {
    it("runs the example migration and rewrites the data with the current version", async () => {
      store({ schemaVersion: 0, progress });
      expect(await repository().load()).toEqual({ status: "loaded", progress });
      expect(stored()).toEqual({ schemaVersion: 1, progress });
    });

    it("chains migrations from the stored version to the current one", async () => {
      // Pretend version 1 stored XP as text and version 2 as a number.
      const toNumber = vi.fn((old: unknown) => {
        const p = old as Record<string, unknown>;
        return { ...p, xp: Number(p.xp) };
      });
      store({ schemaVersion: 1, progress: { ...progress, xp: "150" } });
      const repo = repository({ currentVersion: 2, migrations: { 1: toNumber } });
      expect(await repo.load()).toEqual({ status: "loaded", progress });
      expect(toNumber).toHaveBeenCalledOnce();
      expect(stored()).toEqual({ schemaVersion: 2, progress });
    });

    it("discards data when a migration is missing", async () => {
      store({ schemaVersion: 1, progress });
      const result = await repository({ currentVersion: 3, migrations: { 2: (p) => p } }).load();
      expect(result).toEqual({ status: "discarded", reason: "no migration from 1" });
    });

    it("discards data when a migration throws", async () => {
      store({ schemaVersion: 1, progress });
      const failing = () => {
        throw new Error("boom");
      };
      const result = await repository({ currentVersion: 2, migrations: { 1: failing } }).load();
      expect(result.status).toBe("discarded");
    });
  });

  describe("blocked storage", () => {
    const blocked = () => {
      throw new DOMException("The operation is insecure.", "SecurityError");
    };

    it("loads as a first visit", async () => {
      expect(await repository({ storage: blocked }).load()).toEqual({ status: "empty" });
    });

    it("rejects on save so the UI can tell the player", async () => {
      await expect(repository({ storage: blocked }).save(progress)).rejects.toThrow("insecure");
    });
  });
});
