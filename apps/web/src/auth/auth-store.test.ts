// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProgressStore } from "../progress/progress-store";
import { newProgress, storeProgress, storedProgress } from "../testing/progress-fixture";
import { createAuthStore, type AuthDeps } from "./auth-store";
import { connectCloud } from "./cloud/cloud-backend";
import { PROFILE_SK, TableCloudStore } from "./cloud/table-cloud-store";
import { CALLBACK_PATH } from "./config";
import type { AuthSession } from "./session";
import { MemoryTable } from "./testing/memory-table";

const ACCOUNT = { sub: "user-1", email: "ada@example.com" };

const fakeSession = (table: MemoryTable, overrides: Partial<AuthSession> = {}): AuthSession => ({
  signIn: vi.fn(() => Promise.resolve()),
  completeSignIn: vi.fn(() => Promise.resolve({ account: ACCOUNT, returnTo: "/perfil" })),
  restore: vi.fn(() => Promise.resolve(ACCOUNT)),
  cloud: vi.fn(() => Promise.resolve(new TableCloudStore(table))),
  signOut: vi.fn(() => Promise.resolve()),
  deleteUser: vi.fn(() => Promise.resolve()),
  ...overrides,
});

const deps = (session: AuthSession, overrides: Partial<AuthDeps> = {}): AuthDeps => ({
  config: {
    region: "us-east-2",
    userPoolId: "us-east-2_AbC",
    clientId: "client",
    identityPoolId: "us-east-2:id",
    domain: "x.auth.us-east-2.amazoncognito.com",
    table: "blueprint-profiles",
  },
  fake: false,
  loadSession: () => Promise.resolve(session),
  connect: connectCloud,
  location: () => ({ pathname: "/", href: "http://localhost/" }),
  hasStoredSession: () => false,
  ...overrides,
});

/** init runs the sign-in in the background: wait until it settles. */
const settled = async (store: ReturnType<typeof createAuthStore>) =>
  vi.waitFor(() => expect(store.getState().status).not.toBe("working"));

beforeEach(() => {
  localStorage.clear();
  useProgressStore.setState(useProgressStore.getInitialState(), true);
});

afterEach(() => vi.restoreAllMocks());

describe("auth store (ADR-0029)", () => {
  it("is disabled without a configuration, and leaves the progress to the layout", () => {
    const store = createAuthStore(deps(fakeSession(new MemoryTable()), { config: null }));
    expect(store.getState().status).toBe("disabled");
    expect(store.getState().init()).toBe(false);
  });

  it("is signed out without a session in this tab", () => {
    const store = createAuthStore(deps(fakeSession(new MemoryTable())));
    expect(store.getState().init()).toBe(false);
    expect(store.getState().status).toBe("signed-out");
  });

  it("completes the sign-in on the callback: uploads the guest progress to an empty profile", async () => {
    const guest = { ...newProgress("beginner"), xp: 30 };
    storeProgress(guest);
    const table = new MemoryTable();
    const store = createAuthStore(
      deps(fakeSession(table), {
        location: () => ({
          pathname: CALLBACK_PATH,
          href: `http://localhost${CALLBACK_PATH}?code=x`,
        }),
      }),
    );
    expect(store.getState().init()).toBe(true);
    // Once per page, even if the layout effect runs twice (StrictMode).
    expect(store.getState().init()).toBe(true);
    await settled(store);
    expect(store.getState()).toMatchObject({
      status: "signed-in",
      account: { email: ACCOUNT.email, displayName: null },
      returnTo: "/perfil",
      uploaded: true,
    });
    expect(useProgressStore.getState()).toMatchObject({ status: "ready", progress: guest });
    expect(table.items.get(PROFILE_SK)).toMatchObject({ xp: 30 });
  });

  it("restores the session of the tab and plays with the cloud progress", async () => {
    storeProgress(newProgress("beginner"));
    const table = new MemoryTable();
    const cloud = { ...newProgress("architect"), xp: 500 };
    await new TableCloudStore(table).saveProgress(cloud);
    const store = createAuthStore(deps(fakeSession(table), { hasStoredSession: () => true }));
    expect(store.getState().init()).toBe(true);
    await settled(store);
    expect(store.getState()).toMatchObject({ status: "signed-in", uploaded: false });
    expect(useProgressStore.getState().progress).toEqual(cloud);
    // Saving goes to the cloud; the guest progress of this browser is left as it was.
    await useProgressStore.getState().replace({ ...cloud, xp: 510 });
    expect(table.items.get(PROFILE_SK)).toMatchObject({ xp: 510 });
    expect(storedProgress()?.xp).toBe(0);
  });

  it("falls back to the guest progress when the session cannot be restored", async () => {
    const guest = newProgress("beginner");
    storeProgress(guest);
    const session = fakeSession(new MemoryTable(), { restore: () => Promise.resolve(null) });
    const store = createAuthStore(deps(session, { hasStoredSession: () => true }));
    store.getState().init();
    await settled(store);
    expect(store.getState().status).toBe("signed-out");
    await vi.waitFor(() => expect(useProgressStore.getState().progress).toEqual(guest));
  });

  it("tells a failed sign-in and plays as a guest", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const session = fakeSession(new MemoryTable(), {
      completeSignIn: () => Promise.reject(new Error("invalid_grant")),
    });
    const store = createAuthStore(
      deps(session, { location: () => ({ pathname: CALLBACK_PATH, href: "http://localhost/" }) }),
    );
    store.getState().init();
    await settled(store);
    expect(store.getState()).toMatchObject({ status: "signed-out", error: "sign-in" });
    await vi.waitFor(() => expect(useProgressStore.getState().status).toBe("ready"));
  });

  it("deletes every item, then the user, and goes back to this browser", async () => {
    const table = new MemoryTable();
    const deleteUser = vi.fn(() => Promise.resolve());
    const session = fakeSession(table, { deleteUser });
    const store = createAuthStore(deps(session, { hasStoredSession: () => true }));
    store.getState().init();
    await settled(store);
    useProgressStore
      .getState()
      .attempts.save({ scenarioId: "club-photos", version: 1, commands: [] });
    expect(await store.getState().deleteAccount()).toBe(true);
    expect(table.items.size).toBe(0);
    expect(deleteUser).toHaveBeenCalledOnce();
    expect(store.getState()).toMatchObject({ status: "signed-out", account: null });
    expect(useProgressStore.getState().status).toBe("ready");
  });

  it("stays signed in when the account could not be deleted", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const table = new MemoryTable();
    const session = fakeSession(table, { deleteUser: () => Promise.reject(new Error("500")) });
    const store = createAuthStore(deps(session, { hasStoredSession: () => true }));
    store.getState().init();
    await settled(store);
    expect(await store.getState().deleteAccount()).toBe(false);
    expect(store.getState()).toMatchObject({ status: "signed-in", error: "delete" });
  });

  it("saves the visible name in the profile", async () => {
    const table = new MemoryTable();
    const store = createAuthStore(deps(fakeSession(table), { hasStoredSession: () => true }));
    store.getState().init();
    await settled(store);
    expect(await store.getState().saveDisplayName(" Ada ")).toBe(true);
    expect(store.getState().account?.displayName).toBe("Ada");
    expect(table.items.get(PROFILE_SK)).toMatchObject({ displayName: "Ada" });
  });

  it("signs in through the session, with the path to come back to", async () => {
    const signIn = vi.fn(() => Promise.resolve());
    const store = createAuthStore(deps(fakeSession(new MemoryTable(), { signIn })));
    await store.getState().signIn("/escenarios");
    expect(signIn).toHaveBeenCalledWith("/escenarios");
  });
});
