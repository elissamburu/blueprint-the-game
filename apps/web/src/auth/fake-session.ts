// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// FAKE login and profile, ONLY for the e2e tests (ADR-0029). It is part of a build only with
// `vite build --mode e2e` (apps/web/.env.e2e): vite.config.ts fails a build of any other mode
// with VITE_AUTH_FAKE, and `pnpm deploy:site` refuses a site that contains FAKE_AUTH_MARKER.
// Same flow as the real one, without leaving the site: "Ingresar" goes to CALLBACK_PATH with a
// fake code, the account lives in sessionStorage and the profile in a table in sessionStorage
// (validated with the same schemas as DynamoDB). The tests seed that table to play an account
// that already has progress.
import { TableCloudStore, type ProfileTable } from "./cloud/table-cloud-store";
import { CALLBACK_PATH, safeReturnPath, SESSION_PREFIX } from "./config";
import type { Account, AuthSession } from "./session";

/** Searched in the built site by tools/deploy-site: a site with it is never uploaded. */
export const FAKE_AUTH_MARKER = "blueprint-fake-auth:never-deploy";

export const FAKE_USER_KEY = `${SESSION_PREFIX}fake.user`;
const PENDING_KEY = `${SESSION_PREFIX}fake.pending`;
/** The fake table: { [sk]: item } of the only player. */
export const FAKE_TABLE_KEY = "blueprint.fake-cloud";
export const FAKE_IDENTITY_ID = "us-east-2:00000000-0000-4000-8000-000000000000";
export const FAKE_ACCOUNT: Account = { sub: "fake-user", email: "jugador@example.com" };

class SessionStorageTable implements ProfileTable {
  readonly pk = FAKE_IDENTITY_ID;

  get(sk: string): Promise<unknown> {
    return Promise.resolve(this.#read()[sk]);
  }

  put(item: Readonly<Record<string, unknown>>): Promise<void> {
    const items = this.#read();
    items[String(item.sk)] = { ...item, pk: this.pk };
    this.#write(items);
    return Promise.resolve();
  }

  delete(sk: string): Promise<void> {
    const items = this.#read();
    delete items[sk];
    this.#write(items);
    return Promise.resolve();
  }

  query(skPrefix: string): Promise<unknown[]> {
    return Promise.resolve(
      Object.entries(this.#read())
        .filter(([sk]) => sk.startsWith(skPrefix))
        .map(([, item]) => item),
    );
  }

  #read(): Record<string, unknown> {
    const text = window.sessionStorage.getItem(FAKE_TABLE_KEY);
    const parsed: unknown = text === null ? {} : JSON.parse(text);
    return typeof parsed === "object" && parsed !== null
      ? { ...(parsed as Record<string, unknown>) }
      : {};
  }

  #write(items: Record<string, unknown>): void {
    window.sessionStorage.setItem(FAKE_TABLE_KEY, JSON.stringify(items));
  }
}

export const createFakeSession = (): AuthSession => {
  console.warn(`${FAKE_AUTH_MARKER}: fake login of the e2e tests`);
  const signedIn = (): Account | null =>
    window.sessionStorage.getItem(FAKE_USER_KEY) === null ? null : FAKE_ACCOUNT;
  return {
    signIn: (returnTo) => {
      window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ returnTo }));
      window.location.assign(`${CALLBACK_PATH}?code=fake&state=fake`);
      return Promise.resolve();
    },
    completeSignIn: () => {
      const text = window.sessionStorage.getItem(PENDING_KEY);
      if (text === null) return Promise.reject(new Error("No sign-in in progress"));
      window.sessionStorage.removeItem(PENDING_KEY);
      window.sessionStorage.setItem(FAKE_USER_KEY, "1");
      const pending: unknown = JSON.parse(text);
      const returnTo =
        typeof pending === "object" && pending !== null && "returnTo" in pending
          ? pending.returnTo
          : "/";
      return Promise.resolve({ account: FAKE_ACCOUNT, returnTo: safeReturnPath(returnTo) });
    },
    restore: () => Promise.resolve(signedIn()),
    cloud: () => Promise.resolve(new TableCloudStore(new SessionStorageTable())),
    signOut: () => {
      window.sessionStorage.removeItem(FAKE_USER_KEY);
      window.location.assign("/");
      return Promise.resolve();
    },
    deleteUser: () => {
      window.sessionStorage.removeItem(FAKE_USER_KEY);
      return Promise.resolve();
    },
  };
};
