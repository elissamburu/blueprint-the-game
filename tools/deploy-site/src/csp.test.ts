// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import {
  CSP_MAX_LENGTH,
  cspValuesFromEnv,
  InvalidCspError,
  loadCsp,
  parseCsp,
  PREVIEW_CSP_VALUES,
  renderCsp,
  type CspValues,
} from "./csp.js";

/** The values of the envs/prod Terraform test (infra/envs/prod/tests/prod.tftest.hcl). */
const VALUES: CspValues = {
  awsRegion: "us-east-2",
  authDomain: "acme-login.auth.us-east-2.amazoncognito.com",
};

const BASE = ["default-src 'self'", "script-src 'self'", "object-src 'none'"];
const policy = (...extra: string[]) =>
  [...BASE, ...extra, "frame-ancestors 'none'"].join("\n") + "\n";

describe("parseCsp", () => {
  it("joins one directive per line with '; ', as Terraform does", () => {
    expect(parseCsp(policy(), VALUES)).toBe(
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
  });

  it("ignores blank lines, surrounding spaces and CRLF (a Windows checkout)", () => {
    const text = `\r\n  default-src 'self'  \r\nscript-src 'self'\r\n\r\nobject-src 'none'\r\nframe-ancestors 'none'\r\n`;
    expect(parseCsp(text, VALUES)).toBe(parseCsp(policy(), VALUES));
  });

  it.each([
    ["'unsafe-eval'", policy("connect-src 'self' 'unsafe-eval'")],
    ["'unsafe-inline' for scripts", policy("script-src-elem 'self' 'unsafe-inline'")],
    ["a report endpoint", policy("report-uri https://example.com/csp")],
    ["a repeated directive", policy("img-src 'self'", "img-src data:")],
    ["two directives in a line", policy("img-src 'self'; font-src 'self'")],
    ["a malformed directive", policy("Img-Src 'self'")],
  ])("rejects %s", (_, text) => {
    expect(() => parseCsp(text, VALUES)).toThrow(InvalidCspError);
  });

  it.each(["default-src", "script-src", "object-src", "frame-ancestors"])("requires %s", (name) => {
    const text = policy()
      .split("\n")
      .filter((line) => !line.startsWith(`${name} `))
      .join("\n");
    expect(() => parseCsp(text, VALUES)).toThrow(`Falta la directiva ${name}.`);
  });

  it("fails beyond the length CloudFront accepts in a header", () => {
    const hosts = Array.from({ length: 200 }, (_, i) => `https://h${i}.example.com`).join(" ");
    expect(() => parseCsp(policy(`img-src ${hosts}`), VALUES)).toThrow(`hasta ${CSP_MAX_LENGTH}`);
  });
});

describe("renderCsp", () => {
  it("fills the placeholders as templatefile does", () => {
    expect(
      renderCsp(
        "connect-src 'self' https://${auth_domain} https://dynamodb.${aws_region}.amazonaws.com",
        VALUES,
      ),
    ).toBe(
      "connect-src 'self' https://acme-login.auth.us-east-2.amazoncognito.com https://dynamodb.us-east-2.amazonaws.com",
    );
  });

  it.each([
    ["an unknown placeholder", "img-src ${bucket}"],
    ["a template directive", "img-src %{ if true }x%{ endif }"],
  ])("rejects %s", (_, template) => {
    expect(() => renderCsp(template, VALUES)).toThrow(InvalidCspError);
  });

  it.each([
    ["a wildcard domain", { ...VALUES, authDomain: "*.auth.us-east-2.amazoncognito.com" }],
    [
      "another region's domain",
      { ...VALUES, authDomain: "acme-login.auth.us-west-2.amazoncognito.com" },
    ],
    ["a domain outside Cognito", { ...VALUES, authDomain: "acme-login.example.com" }],
    [
      "a domain with a scheme",
      { ...VALUES, authDomain: "https://acme-login.auth.us-east-2.amazoncognito.com" },
    ],
    ["a malformed region", { ...VALUES, awsRegion: "us-east-2 https://evil.example" }],
  ])("rejects %s", (_, values) => {
    expect(() => renderCsp("connect-src https://${auth_domain}", values)).toThrow(InvalidCspError);
  });
});

describe("cspValuesFromEnv", () => {
  it("takes the values the web is built with", () => {
    expect(
      cspValuesFromEnv({ VITE_AUTH_REGION: VALUES.awsRegion, VITE_AUTH_DOMAIN: VALUES.authDomain }),
    ).toEqual(VALUES);
  });

  it("uses the preview values without a login", () => {
    expect(cspValuesFromEnv({})).toEqual(PREVIEW_CSP_VALUES);
  });

  it("fails with only one of the two", () => {
    expect(() => cspValuesFromEnv({ VITE_AUTH_REGION: "us-east-2" })).toThrow(InvalidCspError);
  });
});

describe("the policy of the site", () => {
  // The same string the envs/prod Terraform test expects from templatefile with these values: the
  // response headers policy and the preview server send the same header.
  it("lets the web call only the login and the profile endpoints of its region", async () => {
    expect(await loadCsp(VALUES)).toContain(
      "; connect-src 'self' https://acme-login.auth.us-east-2.amazoncognito.com https://cognito-idp.us-east-2.amazonaws.com https://cognito-identity.us-east-2.amazonaws.com https://dynamodb.us-east-2.amazonaws.com; ",
    );
  });

  it("keeps form-action 'none': the login is a navigation, not a form of the site", async () => {
    expect(await loadCsp(VALUES)).toContain("; form-action 'none'; ");
  });

  it("is valid and fits in the header", async () => {
    const value = await loadCsp(VALUES);
    expect(value.length).toBeLessThanOrEqual(CSP_MAX_LENGTH);
    expect(value).toMatch(/^default-src 'self'; /);
  });

  it("keeps scripts to the site's own files and cannot be framed", async () => {
    const directives = new Map(
      (await loadCsp(VALUES))
        .split("; ")
        .map((d) => [d.split(" ")[0], d.slice(d.indexOf(" ") + 1)]),
    );
    expect(directives.get("script-src")).toBe("'self'");
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'none'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
  });
});
