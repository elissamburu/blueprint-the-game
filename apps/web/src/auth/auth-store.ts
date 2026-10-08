// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// State of the login (ADR-0029). Part of the initial bundle, so it only holds the state: the
// session (oidc-client-ts, the AWS SDK) and the cloud backend come with import() when the player
// signs in or this tab already has a session. Signing in moves the progress store to the cloud
// profile (cloud/cloud-backend.ts); signing out or deleting the account moves it back to this
// browser. Without a configuration (VITE_AUTH_*) the status is "disabled" and nothing else runs.
import { create } from "zustand";
import { listLocalAttempts } from "../progress/local-storage-attempt-repository";
import { LocalStorageProgressRepository } from "../progress/local-storage-progress-repository";
import { localBackend, useProgressStore } from "../progress/progress-store";
import {
  authConfig,
  CALLBACK_PATH,
  FAKE_AUTH,
  hasStoredSession,
  type AuthConfig,
  type IdentityProvider,
} from "./config";
import type { connectCloud } from "./cloud/cloud-backend";
import type { AuthSession, CloudStore } from "./session";

export type AuthStatus = "disabled" | "signed-out" | "working" | "signed-in";

export type AuthError = "sign-in" | "sign-out" | "delete" | "display-name";

export interface SignedInAccount {
  readonly email: string;
  readonly displayName: string | null;
}

export interface AuthState {
  readonly status: AuthStatus;
  readonly account: SignedInAccount | null;
  /** Where to go after the callback (a path of this site). */
  readonly returnTo: string | null;
  readonly error: AuthError | null;
  /** This browser's progress went up to an empty profile (told once). */
  readonly uploaded: boolean;
  /**
   * Starts the login on page load. True when it takes care of reading the progress (a callback
   * or a session to restore); otherwise the layout hydrates the local progress.
   */
  init: () => boolean;
  signIn: (returnTo: string, provider?: IdentityProvider) => Promise<void>;
  signOut: () => Promise<void>;
  /** Deletes every item of the profile, then the Cognito user. */
  deleteAccount: () => Promise<boolean>;
  saveDisplayName: (displayName: string) => Promise<boolean>;
  dismissError: () => void;
  dismissUploaded: () => void;
}

export interface AuthDeps {
  readonly config: AuthConfig | null;
  readonly fake: boolean;
  readonly loadSession: () => Promise<AuthSession>;
  readonly connect: typeof connectCloud;
  readonly location: () => { pathname: string; href: string };
  readonly hasStoredSession: () => boolean;
}

const defaultDeps = (): AuthDeps => ({
  config: authConfig,
  fake: FAKE_AUTH,
  // __BLUEPRINT_FAKE_AUTH__ is a literal of the build (vite.config.ts): any build but the one of
  // the e2e tests drops this branch, and the fake module with it.
  loadSession: async () => {
    if (__BLUEPRINT_FAKE_AUTH__) return (await import("./fake-session")).createFakeSession();
    if (authConfig === null) throw new Error("Login not configured");
    return (await import("./cognito-session")).createCognitoSession(authConfig);
  },
  connect: async (...args) => (await import("./cloud/cloud-backend")).connectCloud(...args),
  location: () => window.location,
  hasStoredSession: () => hasStoredSession(),
});

export const createAuthStore = (deps: AuthDeps = defaultDeps()) =>
  create<AuthState>()((set, get) => {
    let session: AuthSession | null = null;
    let cloud: CloudStore | null = null;
    /** What init answered: it runs once per page (StrictMode runs effects twice in development). */
    let started: boolean | null = null;
    const sessionOnce = async () => (session ??= await deps.loadSession());

    const backToLocal = async () => {
      cloud = null;
      await useProgressStore.getState().switchTo(localBackend());
    };

    /** After the callback or a restored session: the profile, then the progress from it. */
    const connect = async (email: string) => {
      const current = await sessionOnce();
      cloud = await current.cloud();
      const connected = await deps.connect(cloud, {
        progress: new LocalStorageProgressRepository(),
        attempts: () => listLocalAttempts(),
      });
      await useProgressStore.getState().switchTo(connected.backend);
      set({
        status: "signed-in",
        account: { email, displayName: connected.info.displayName },
        uploaded: connected.uploaded,
      });
    };

    const run = (work: () => Promise<void>) => {
      set({ status: "working", error: null });
      work().catch(async (error: unknown) => {
        console.warn(`Sign-in failed: ${String(error)}`);
        set({ status: "signed-out", account: null, error: "sign-in" });
        await backToLocal();
      });
    };

    return {
      status: deps.config === null && !deps.fake ? "disabled" : "signed-out",
      account: null,
      returnTo: null,
      error: null,
      uploaded: false,
      init: () => {
        if (started !== null) return started;
        started = false;
        if (get().status === "disabled") return false;
        const { pathname, href } = deps.location();
        started = true;
        if (pathname === CALLBACK_PATH) {
          run(async () => {
            const { account, returnTo } = await (await sessionOnce()).completeSignIn(href);
            set({ returnTo });
            await connect(account.email);
          });
          return true;
        }
        if (!deps.hasStoredSession()) {
          started = false;
          return false;
        }
        run(async () => {
          const account = await (await sessionOnce()).restore();
          if (account === null) {
            set({ status: "signed-out" });
            await backToLocal();
            return;
          }
          await connect(account.email);
        });
        return true;
      },
      signIn: async (returnTo, provider) => {
        set({ status: "working", error: null });
        try {
          await (await sessionOnce()).signIn(returnTo, provider);
        } catch (error) {
          console.warn(`Sign-in failed: ${String(error)}`);
          set({ status: "signed-out", error: "sign-in" });
        }
      },
      signOut: async () => {
        set({ status: "working", error: null });
        try {
          await (await sessionOnce()).signOut();
        } catch (error) {
          console.warn(`Sign-out failed: ${String(error)}`);
          set({ status: "signed-in", error: "sign-out" });
        }
      },
      deleteAccount: async () => {
        const current = session;
        if (current === null || cloud === null) return false;
        set({ status: "working", error: null });
        try {
          // Writes of games in progress still on their way would recreate items after deleting.
          await useProgressStore.getState().attempts.flush?.();
          await cloud.deleteAll();
          await current.deleteUser();
        } catch (error) {
          console.warn(`Account not deleted: ${String(error)}`);
          set({ status: "signed-in", error: "delete" });
          return false;
        }
        set({ status: "signed-out", account: null });
        await backToLocal();
        return true;
      },
      saveDisplayName: async (displayName) => {
        const account = get().account;
        if (cloud === null || account === null) return false;
        try {
          await cloud.saveDisplayName(displayName);
        } catch (error) {
          console.warn(`Display name not saved: ${String(error)}`);
          set({ error: "display-name" });
          return false;
        }
        set({ account: { ...account, displayName: displayName.trim() }, error: null });
        return true;
      },
      dismissError: () => set({ error: null }),
      dismissUploaded: () => set({ uploaded: false }),
    };
  });

export const useAuthStore = createAuthStore();
