// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { commands, type SavedAttempt } from "@blueprint/game-engine";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ATTEMPT_SCHEMA_VERSION,
  ATTEMPT_STORAGE_PREFIX,
  LocalStorageAttemptRepository,
} from "./local-storage-attempt-repository";

const attempt: SavedAttempt = {
  scenarioId: "club-photos",
  version: 2,
  commands: [
    commands.placeService("store", "efs"),
    commands.clearSlot("store"),
    commands.placeService("store", "s3"),
    commands.useHint("index"),
    commands.placeService("thumbnailer", "fargate"),
    commands.acceptAcceptable("thumbnailer"),
    commands.revealSolution("index"),
    commands.revealSolution(null),
  ],
};
const KEY = `${ATTEMPT_STORAGE_PREFIX}club-photos`;

let warn: ReturnType<typeof vi.fn<(message: string) => void>>;
let repository: LocalStorageAttemptRepository;

beforeEach(() => {
  localStorage.clear();
  warn = vi.fn<(message: string) => void>();
  repository = new LocalStorageAttemptRepository({ warn });
});

describe("LocalStorageAttemptRepository", () => {
  it("keeps one game per scenario and reads it back", () => {
    expect(repository.load("club-photos")).toBeNull();
    repository.save(attempt);
    repository.save({ ...attempt, scenarioId: "photo-queue", commands: [] });
    expect(repository.load("club-photos")).toEqual(attempt);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "")).toEqual({
      schemaVersion: ATTEMPT_SCHEMA_VERSION,
      attempt,
    });
    repository.clear("club-photos");
    expect(repository.load("club-photos")).toBeNull();
    expect(repository.load("photo-queue")).not.toBeNull();
  });

  it.each([
    ["not JSON", "{"],
    ["an older format", JSON.stringify({ schemaVersion: 0, attempt })],
    ["a newer format", JSON.stringify({ schemaVersion: ATTEMPT_SCHEMA_VERSION + 1, attempt })],
    [
      "an unknown command",
      JSON.stringify({
        schemaVersion: ATTEMPT_SCHEMA_VERSION,
        attempt: { ...attempt, commands: [{ type: "winScenario" }] },
      }),
    ],
    [
      "a command with extra fields",
      JSON.stringify({
        schemaVersion: ATTEMPT_SCHEMA_VERSION,
        attempt: { ...attempt, commands: [{ type: "useHint", slotId: "a", score: 999 }] },
      }),
    ],
    [
      "a game of another scenario",
      JSON.stringify({
        schemaVersion: ATTEMPT_SCHEMA_VERSION,
        attempt: { ...attempt, scenarioId: "photo-queue" },
      }),
    ],
  ])("drops a stored game that is %s, with a warning", (_, text) => {
    localStorage.setItem(KEY, text);
    expect(repository.load("club-photos")).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });

  it("clearAll forgets every game and nothing else", () => {
    repository.save(attempt);
    repository.save({ ...attempt, scenarioId: "photo-queue" });
    localStorage.setItem("blueprint.progress", "{}");
    repository.clearAll();
    expect(Object.keys(localStorage)).toEqual(["blueprint.progress"]);
  });

  it("goes on without keeping anything when the storage is blocked or full", () => {
    const blocked = new LocalStorageAttemptRepository({
      warn,
      storage: () => {
        throw new Error("SecurityError");
      },
    });
    expect(blocked.load("club-photos")).toBeNull();
    expect(() => {
      blocked.save(attempt);
      blocked.clear("club-photos");
      blocked.clearAll();
    }).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
