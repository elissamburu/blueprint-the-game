// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlayerProgress } from "@blueprint/game-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  IncompatibleProgressError,
  LocalStorageProgressRepository,
  PROGRESS_STORAGE_KEY,
  type LocalStorageProgressRepositoryOptions,
} from "./local-storage-progress-repository";
import { PROGRESS_SCHEMA_VERSION } from "./progress-schema";

const BACKUP_KEY = `${PROGRESS_STORAGE_KEY}.backup`;

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
  interests: ["networking"],
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
      allOptimal: false,
    },
  },
  unlocked: [
    { area: "networking", level: 100 },
    { area: "networking", level: 200 },
  ],
  started: ["static-website-https"],
};

/** The same progress as version 1 stored it: without interests, started nor allOptimal. */
const progressV1 = {
  experience: "aws-user",
  xp: 150,
  best: {
    "static-website-https": {
      version: 1,
      level: 100 as const,
      areas: ["networking", "storage"],
      score: 350,
      maxScore: 400,
      xp: 150,
      hintsUsed: 1,
      perfect: false,
    },
  },
  unlocked: progress.unlocked,
};

const CURRENT = PROGRESS_SCHEMA_VERSION;

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
    expect(stored()).toEqual({ schemaVersion: CURRENT, progress });
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
        { schemaVersion: CURRENT, progress: { ...progress, experience: "guru" } },
      ],
      ["negative XP", { schemaVersion: CURRENT, progress: { ...progress, xp: -1 } }],
      [
        "an invalid level",
        {
          schemaVersion: CURRENT,
          progress: { ...progress, unlocked: [{ area: "x", level: 150 }] },
        },
      ],
      ["unknown fields", { schemaVersion: CURRENT, progress: { ...progress, streak: 4 } }],
    ])("discards %s with a warning, backs it up and removes it", async (_case, value) => {
      store(value);
      const original = storage.getItem(PROGRESS_STORAGE_KEY);
      const result = await repository().load();
      expect(result.status).toBe("discarded");
      expect(warn).toHaveBeenCalledOnce();
      expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
      expect(storage.getItem(BACKUP_KEY)).toBe(original);
      // The next visit starts clean, without warning again.
      expect(await repository().load()).toEqual({ status: "empty" });
      expect(warn).toHaveBeenCalledOnce();
    });

    it("keeps a single backup: the last discarded text replaces the previous one", async () => {
      store("{first");
      await repository().load();
      store("{second");
      await repository().load();
      expect(storage.getItem(BACKUP_KEY)).toBe("{second");
      expect(storage.length).toBe(1);
    });

    it("still removes the data when the backup does not fit", async () => {
      store("{not json");
      const setItem = vi.spyOn(storage, "setItem").mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
      expect((await repository().load()).status).toBe("discarded");
      setItem.mockRestore();
      expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBeNull();
    });
  });

  describe("data from a newer version of the game", () => {
    // Stored by a newer version of the game, read by this app.
    const newer = JSON.stringify({
      schemaVersion: CURRENT + 1,
      progress: { ...progress, streak: 4 },
    });

    it("is not loaded and stays intact after load and a save attempt", async () => {
      storage.setItem(PROGRESS_STORAGE_KEY, newer);
      const repo = repository();
      expect(await repo.load()).toEqual({ status: "incompatible", storedVersion: CURRENT + 1 });
      await expect(repo.save(progress)).rejects.toBeInstanceOf(IncompatibleProgressError);
      await repo.clear();
      expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(newer);
      expect(storage.getItem(BACKUP_KEY)).toBeNull();
      expect(warn).toHaveBeenCalledOnce();
    });

    it("unblocks writes when a later load finds data it can read", async () => {
      storage.setItem(PROGRESS_STORAGE_KEY, newer);
      const repo = repository();
      await repo.load();
      storage.removeItem(PROGRESS_STORAGE_KEY);
      expect(await repo.load()).toEqual({ status: "empty" });
      await repo.save(progress);
      expect(stored()).toEqual({ schemaVersion: CURRENT, progress });
    });
  });

  describe("migrations", () => {
    const migrated: PlayerProgress = {
      ...progress,
      interests: [],
      started: [],
      best: {
        "static-website-https": { ...progressV1.best["static-website-https"], allOptimal: false },
      },
    };

    it("runs the real migrations and rewrites the data with the current version", async () => {
      store({ schemaVersion: 0, progress: progressV1 });
      expect(await repository().load()).toEqual({ status: "loaded", progress: migrated });
      expect(stored()).toEqual({ schemaVersion: CURRENT, progress: migrated });
    });

    it("v1 → v2: no interests nor started scenarios; only a perfect result is all green", async () => {
      const result = progressV1.best["static-website-https"];
      store({
        schemaVersion: 1,
        progress: { ...progressV1, best: { a: { ...result, perfect: true }, b: result } },
      });
      const loaded = await repository().load();
      if (loaded.status !== "loaded") throw new Error(loaded.status);
      expect(loaded.progress.interests).toEqual([]);
      expect(loaded.progress.started).toEqual([]);
      expect(loaded.progress.best.a?.allOptimal).toBe(true);
      expect(loaded.progress.best.b?.allOptimal).toBe(false);
    });

    it.each([
      ["a progress that is not an object", []],
      ["a best result that is not an object", { ...progressV1, best: { a: 3 } }],
      ["best results that are not a record", { ...progressV1, best: null }],
    ])("v1 → v2 leaves %s to the validation", async (_case, value) => {
      store({ schemaVersion: 1, progress: value });
      expect((await repository().load()).status).toBe("discarded");
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
