// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The two ports of the login (ADR-0029). AuthSession is the account: Cognito with oidc-client-ts
// (cognito-session.ts), or the fake of the e2e tests (fake-session.ts). CloudStore is the
// player's profile: DynamoDB, or a table in sessionStorage for the fake. Only types here: both
// implementations are loaded with import() after the player chooses to sign in.
import type { PlayerProgress, SavedAttempt } from "@blueprint/game-engine";
import type { ProgressLoad } from "../progress/progress-repository";
import type { IdentityProvider } from "./config";

export interface Account {
  /** sub of the ID token. */
  readonly sub: string;
  /** Shown in the menu only: it lives in Cognito, never in the profile table. */
  readonly email: string;
}

export interface AuthSession {
  /**
   * Goes to the hosted UI (the page is left). With a provider, straight to it (identity_provider of
   * the authorize endpoint) instead of the page of email and password.
   */
  signIn(returnTo: string, provider?: IdentityProvider): Promise<void>;
  /** On CALLBACK_PATH: exchanges the code (PKCE). Where to go back is a path of this site. */
  completeSignIn(url: string): Promise<{ account: Account; returnTo: string }>;
  /** The session of this tab, if any. */
  restore(): Promise<Account | null>;
  /** The player's profile, with temporary credentials of the identity pool. */
  cloud(): Promise<CloudStore>;
  /** Revokes the refresh token, forgets the session and goes to the logout of the hosted UI. */
  signOut(): Promise<void>;
  /** Deletes the Cognito user (DeleteUser) and forgets the session; the page stays. */
  deleteUser(): Promise<void>;
}

/** What the profile holds besides the progress. */
export interface ProfileInfo {
  readonly displayName: string | null;
}

export type ProfileRead =
  /** No profile yet: the first sign-in of this account. */
  | { readonly status: "empty" }
  | { readonly status: "loaded"; readonly info: ProfileInfo; readonly progress: ProgressLoad };

export interface CloudStore {
  loadProfile(): Promise<ProfileRead>;
  saveProgress(progress: PlayerProgress): Promise<void>;
  /** "Reiniciar progreso": the profile stays (with its name), without progress. */
  clearProgress(): Promise<void>;
  saveDisplayName(displayName: string): Promise<void>;
  loadAttempts(): Promise<SavedAttempt[]>;
  saveAttempt(attempt: SavedAttempt): Promise<void>;
  deleteAttempt(scenarioId: string): Promise<void>;
  /** Every item of the player ("Eliminar mi cuenta"). */
  deleteAll(): Promise<void>;
}
