// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { beforeEach, describe, expect, it } from "vitest";
import { clearLocalDraft, readLocalDraft, writeLocalDraft } from "./local-draft";

const draft = { text: "id: abc\r\ntitle: Hola\r\n", baseHash: "a".repeat(64) };

beforeEach(() => {
  localStorage.clear();
});

describe("local draft", () => {
  it("writes, reads and clears the copy of one scenario", () => {
    writeLocalDraft("abc", draft);
    writeLocalDraft("otro", { text: "otro", baseHash: "b" });
    expect(readLocalDraft("abc")).toEqual(draft);
    clearLocalDraft("abc");
    expect(readLocalDraft("abc")).toBeUndefined();
    expect(readLocalDraft("otro")).toEqual({ text: "otro", baseHash: "b" });
  });

  it("ignores an entry that is not a draft", () => {
    localStorage.setItem("blueprint-studio:draft:abc", "{ no es json");
    expect(readLocalDraft("abc")).toBeUndefined();
    localStorage.setItem("blueprint-studio:draft:abc", JSON.stringify({ text: 3 }));
    expect(readLocalDraft("abc")).toBeUndefined();
  });

  it("works without storage, or with storage that throws", () => {
    const missing = () => undefined;
    expect(() => writeLocalDraft("abc", draft, missing)).not.toThrow();
    expect(readLocalDraft("abc", missing)).toBeUndefined();
    expect(() => clearLocalDraft("abc", missing)).not.toThrow();

    const blocked = (): Storage => {
      throw new DOMException("blocked", "SecurityError");
    };
    expect(() => writeLocalDraft("abc", draft, blocked)).not.toThrow();
    expect(readLocalDraft("abc", blocked)).toBeUndefined();
    expect(() => clearLocalDraft("abc", blocked)).not.toThrow();

    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    } as unknown as Storage;
    expect(() => writeLocalDraft("abc", draft, () => full)).not.toThrow();
    expect(() => clearLocalDraft("abc", () => full)).not.toThrow();
  });
});
