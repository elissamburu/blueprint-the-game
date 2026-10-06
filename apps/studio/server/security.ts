// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Middlewares of the security rules of ADR-0025 §4: S2 (Host), S3 (CSRF: Origin, Sec-Fetch-Site,
// token and JSON bodies) and S9 (headers). S4 is an absence: no CORS middleware is registered and
// no response carries Access-Control-Allow-*.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { TOKEN_HEADER } from "../shared/api.js";
import { errorResponse } from "./errors.js";

/** S12: 32 random bytes per start, kept only in memory. */
export const createToken = (): string => randomBytes(32).toString("base64url");

/** S3: constant-time comparison; hashing first makes both sides the same length. */
export const tokensEqual = (expected: string, received: string | undefined): boolean => {
  if (received === undefined) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(received).digest();
  return timingSafeEqual(a, b);
};

/** S2: the only Host values accepted, with the port the server listens on. */
export const allowedHosts = (port: number): readonly string[] => [
  `127.0.0.1:${port}`,
  `localhost:${port}`,
];

/** S3: the only Origin values accepted on unsafe methods. */
export const allowedOrigins = (port: number): readonly string[] =>
  allowedHosts(port).map((host) => `http://${host}`);

export const isAllowedHost = (host: string | undefined, port: number): boolean =>
  host !== undefined && allowedHosts(port).includes(host.toLowerCase());

/** S9: Content-Security-Policy of `pnpm studio`. CodeMirror injects inline styles. */
export const CSP = "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'";

/** S9: headers on every response, the HTML and /api/* included. */
export const securityHeaderEntries = (csp: string): [string, string][] => [
  ["Content-Security-Policy", csp],
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "no-referrer"],
];

export const securityHeaders =
  (csp: string): MiddlewareHandler =>
  async (c, next) => {
    await next();
    for (const [name, value] of securityHeaderEntries(csp)) c.res.headers.set(name, value);
  };

/** S2: DNS rebinding. A missing Host or any other value gets 421 before anything else runs. */
export const hostGuard =
  (port: number): MiddlewareHandler =>
  async (c, next) => {
    if (!isAllowedHost(c.req.header("host"), port)) {
      return errorResponse(
        c,
        421,
        "misdirected-request",
        "El Studio solo atiende pedidos dirigidos a 127.0.0.1 o localhost con su puerto.",
      );
    }
    return next();
  };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const isJson = (contentType: string | undefined): boolean =>
  contentType !== undefined &&
  contentType.split(";")[0]?.trim().toLowerCase() === "application/json";

/**
 * S3 on every /api route: (1) unsafe methods need an Origin of the Studio itself; (2) a
 * Sec-Fetch-Site other than same-origin is refused; (3) the session token in X-Studio-Token,
 * also on GET; (4) bodies only as application/json. Everything runs before the route, so a
 * refused request never touches the disk.
 */
export const apiGuard =
  ({ port, token }: { port: number; token: string }): MiddlewareHandler =>
  async (c, next) => {
    const forbidden = (message: string) => errorResponse(c, 403, "forbidden", message);
    const unsafe = !SAFE_METHODS.has(c.req.method);
    if (unsafe) {
      const origin = c.req.header("origin");
      if (origin === undefined || !allowedOrigins(port).includes(origin.toLowerCase())) {
        return forbidden("El pedido no viene del Studio (Origin ausente o de otro sitio).");
      }
    }
    const site = c.req.header("sec-fetch-site");
    if (site !== undefined && site !== "same-origin") {
      return forbidden("El pedido no viene del Studio (Sec-Fetch-Site no es same-origin).");
    }
    if (!tokensEqual(token, c.req.header(TOKEN_HEADER))) {
      return errorResponse(
        c,
        403,
        "invalid-token",
        "Falta el token de la sesión del Studio o no es válido: recargá la página.",
      );
    }
    if (unsafe && !isJson(c.req.header("content-type"))) {
      return errorResponse(
        c,
        415,
        "unsupported-media-type",
        "El cuerpo del pedido tiene que ser application/json.",
      );
    }
    return next();
  };
