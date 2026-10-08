// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The login with Cognito (ADR-0029), loaded with import() only when the player signs in or has a
// session in this tab: oidc-client-ts and the AWS SDK never reach the initial bundle (RNF-03).
//   - Authorization code with PKCE against the hosted UI of the user pool (public client, no
//     secret). The endpoints are fixed in the settings, so there is no discovery request.
//   - The tokens and the PKCE state live in sessionStorage, never localStorage: they end with the
//     tab. oidc-client-ts renews the tokens with the refresh token before they expire.
//   - Logout revokes the refresh token (/oauth2/revoke, which also invalidates the access tokens
//     issued with it) and goes to /logout of the hosted UI, which ends its own session.
//   - DynamoDB with temporary credentials of the identity pool for the ID token. The identity ID
//     is the partition key of the player's items.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  fromCognitoIdentityPool,
  type Storage,
} from "@aws-sdk/credential-provider-cognito-identity";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { UserManager, WebStorageStateStore, type User } from "oidc-client-ts";
import { DynamoDbProfileTable } from "./cloud/dynamodb-table";
import { TableCloudStore } from "./cloud/table-cloud-store";
import { CALLBACK_PATH, safeReturnPath, SESSION_PREFIX, type AuthConfig } from "./config";
import type { Account, AuthSession, CloudStore } from "./session";

/** Scopes of the app client; aws.cognito.signin.user.admin is what DeleteUser needs. */
const SCOPE = "openid email profile aws.cognito.signin.user.admin";

/** Identity IDs in memory only (the provider would otherwise pick IndexedDB or localStorage). */
const memoryCache = (): Storage => {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
};

const accountOf = (user: User): Account => {
  const { sub, email } = user.profile;
  if (typeof email !== "string" || email === "") throw new Error("The ID token has no email");
  return { sub, email };
};

export const createCognitoSession = (config: AuthConfig): AuthSession => {
  const origin = window.location.origin;
  const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
  const hostedUi = `https://${config.domain}`;
  const storage = new WebStorageStateStore({
    store: window.sessionStorage,
    prefix: SESSION_PREFIX,
  });
  const users = new UserManager({
    authority: issuer,
    client_id: config.clientId,
    redirect_uri: `${origin}${CALLBACK_PATH}`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: "code",
    scope: SCOPE,
    // The endpoints of the user pool and its domain (User pool endpoints reference:
    // https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-userpools-server-contract-reference.html).
    metadata: {
      issuer,
      authorization_endpoint: `${hostedUi}/oauth2/authorize`,
      token_endpoint: `${hostedUi}/oauth2/token`,
      revocation_endpoint: `${hostedUi}/oauth2/revoke`,
      userinfo_endpoint: `${hostedUi}/oauth2/userInfo`,
      end_session_endpoint: `${hostedUi}/logout`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
    },
    userStore: storage,
    stateStore: storage,
    loadUserInfo: false,
    monitorSession: false,
    automaticSilentRenew: true,
  });

  const currentUser = async (): Promise<User> => {
    const user = await users.getUser();
    if (user === null) throw new Error("Not signed in");
    if (!user.expired) return user;
    const renewed = await users.signinSilent();
    if (renewed === null) throw new Error("The session could not be renewed");
    return renewed;
  };

  let cloud: Promise<CloudStore> | null = null;
  const connect = async (): Promise<CloudStore> => {
    const credentials = fromCognitoIdentityPool({
      identityPoolId: config.identityPoolId,
      clientConfig: { region: config.region },
      logins: {
        [`cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`]: async () => {
          const user = await currentUser();
          if (user.id_token === undefined) throw new Error("The session has no ID token");
          return user.id_token;
        },
      },
      cache: memoryCache(),
    });
    const { identityId } = await credentials();
    const client = DynamoDBDocumentClient.from(
      // The regional endpoint (connect-src of the CSP), never the account-based one.
      new DynamoDBClient({ region: config.region, credentials, accountIdEndpointMode: "disabled" }),
      { marshallOptions: { removeUndefinedValues: true } },
    );
    return new TableCloudStore(new DynamoDbProfileTable(client, config.table, identityId));
  };

  return {
    signIn: async (returnTo, provider) => {
      await users.clearStaleState();
      // identity_provider skips the page of the hosted UI and goes to Google (Authorize endpoint:
      // https://docs.aws.amazon.com/cognito/latest/developerguide/authorization-endpoint.html).
      await users.signinRedirect({
        state: { returnTo },
        ...(provider === undefined ? {} : { extraQueryParams: { identity_provider: provider } }),
      });
    },
    completeSignIn: async (url) => {
      const user = await users.signinRedirectCallback(url);
      const state: unknown = user.state;
      const returnTo =
        typeof state === "object" && state !== null && "returnTo" in state ? state.returnTo : "/";
      return { account: accountOf(user), returnTo: safeReturnPath(returnTo) };
    },
    restore: async () => {
      try {
        return accountOf(await currentUser());
      } catch {
        await users.removeUser();
        return null;
      }
    },
    cloud: () => (cloud ??= connect()),
    signOut: async () => {
      try {
        // Cognito revokes refresh tokens only (Revoke endpoint).
        await users.revokeTokens(["refresh_token"]);
      } catch (error) {
        console.warn(`Refresh token not revoked: ${String(error)}`);
      }
      await users.removeUser();
      const logout = new URL(`${hostedUi}/logout`);
      logout.searchParams.set("client_id", config.clientId);
      logout.searchParams.set("logout_uri", `${origin}/`);
      window.location.assign(logout.toString());
    },
    deleteUser: async () => {
      const user = await currentUser();
      // DeleteUser is authorized by the access token, not by IAM (DeleteUser API reference).
      const response = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "X-Amz-Target": "AWSCognitoIdentityProviderService.DeleteUser",
        },
        body: JSON.stringify({ AccessToken: user.access_token }),
      });
      if (!response.ok) throw new Error(`DeleteUser failed (${response.status})`);
      await users.removeUser();
    },
  };
};
