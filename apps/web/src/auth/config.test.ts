// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it, vi } from "vitest";
import {
  CALLBACK_PATH,
  hasStoredSession,
  readAuthConfig,
  readGoogleSignIn,
  safeReturnPath,
} from "./config";

const ENV = {
  VITE_AUTH_REGION: "us-east-2",
  VITE_AUTH_USER_POOL_ID: "us-east-2_AbCdEf123",
  VITE_AUTH_CLIENT_ID: "1example23456789abcdefghij",
  VITE_AUTH_IDENTITY_POOL_ID: "us-east-2:11111111-2222-4333-8444-555555555555",
  VITE_AUTH_DOMAIN: "blueprint-login.auth.us-east-2.amazoncognito.com",
  VITE_AUTH_TABLE: "blueprint-profiles",
};

describe("readAuthConfig", () => {
  it("has no login without the variables (guest mode)", () => {
    const warn = vi.fn();
    expect(readAuthConfig({}, warn)).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("reads the six variables", () => {
    expect(readAuthConfig(ENV)).toEqual({
      region: "us-east-2",
      userPoolId: "us-east-2_AbCdEf123",
      clientId: "1example23456789abcdefghij",
      identityPoolId: "us-east-2:11111111-2222-4333-8444-555555555555",
      domain: "blueprint-login.auth.us-east-2.amazoncognito.com",
      table: "blueprint-profiles",
    });
  });

  it.each([
    ["a missing variable", { ...ENV, VITE_AUTH_TABLE: "" }],
    ["a domain outside Cognito", { ...ENV, VITE_AUTH_DOMAIN: "login.example.com" }],
    [
      "a domain of another region",
      { ...ENV, VITE_AUTH_DOMAIN: "x.auth.us-west-2.amazoncognito.com" },
    ],
    ["a user pool of another region", { ...ENV, VITE_AUTH_USER_POOL_ID: "us-west-2_AbCdEf123" }],
    ["a malformed identity pool", { ...ENV, VITE_AUTH_IDENTITY_POOL_ID: "nope" }],
  ])("disables the login with %s, with a warning", (_, env) => {
    const warn = vi.fn();
    expect(readAuthConfig(env, warn)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("safeReturnPath", () => {
  it.each([
    ["/escenarios/club-photos?x=1", "/escenarios/club-photos?x=1"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    [CALLBACK_PATH, "/"],
    [42, "/"],
  ])("%j → %j", (value, expected) => {
    expect(safeReturnPath(value)).toBe(expected);
  });
});

describe("hasStoredSession", () => {
  it("looks for a user of the login in sessionStorage only", () => {
    sessionStorage.clear();
    expect(hasStoredSession()).toBe(false);
    sessionStorage.setItem("blueprint.auth.state.abc", "{}");
    expect(hasStoredSession()).toBe(false);
    sessionStorage.setItem("blueprint.auth.user:https://issuer:client", "{}");
    expect(hasStoredSession()).toBe(true);
    sessionStorage.clear();
  });

  it("is false when the storage is blocked", () => {
    expect(
      hasStoredSession(() => {
        throw new Error("SecurityError");
      }),
    ).toBe(false);
  });
});

describe("readGoogleSignIn", () => {
  it("shows Google only with a login and VITE_AUTH_GOOGLE=true", () => {
    expect(readGoogleSignIn(true, "true")).toBe(true);
    expect(readGoogleSignIn(true, "false")).toBe(false);
    expect(readGoogleSignIn(true, undefined)).toBe(false);
    expect(readGoogleSignIn(false, "true")).toBe(false);
  });
});
