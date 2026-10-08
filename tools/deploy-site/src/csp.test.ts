// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { CSP_MAX_LENGTH, InvalidCspError, loadCsp, parseCsp } from "./csp.js";

const BASE = ["default-src 'self'", "script-src 'self'", "object-src 'none'"];
const policy = (...extra: string[]) =>
  [...BASE, ...extra, "frame-ancestors 'none'"].join("\n") + "\n";

describe("parseCsp", () => {
  it("joins one directive per line with '; ', as Terraform does", () => {
    expect(parseCsp(policy())).toBe(
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'",
    );
  });

  it("ignores blank lines, surrounding spaces and CRLF (a Windows checkout)", () => {
    const text = `\r\n  default-src 'self'  \r\nscript-src 'self'\r\n\r\nobject-src 'none'\r\nframe-ancestors 'none'\r\n`;
    expect(parseCsp(text)).toBe(parseCsp(policy()));
  });

  it.each([
    ["'unsafe-eval'", policy("connect-src 'self' 'unsafe-eval'")],
    ["'unsafe-inline' for scripts", policy("script-src-elem 'self' 'unsafe-inline'")],
    ["a report endpoint", policy("report-uri https://example.com/csp")],
    ["a repeated directive", policy("img-src 'self'", "img-src data:")],
    ["two directives in a line", policy("img-src 'self'; font-src 'self'")],
    ["a malformed directive", policy("Img-Src 'self'")],
  ])("rejects %s", (_, text) => {
    expect(() => parseCsp(text)).toThrow(InvalidCspError);
  });

  it.each(["default-src", "script-src", "object-src", "frame-ancestors"])("requires %s", (name) => {
    const text = policy()
      .split("\n")
      .filter((line) => !line.startsWith(`${name} `))
      .join("\n");
    expect(() => parseCsp(text)).toThrow(`Falta la directiva ${name}.`);
  });

  it("fails beyond the length CloudFront accepts in a header", () => {
    const hosts = Array.from({ length: 200 }, (_, i) => `https://h${i}.example.com`).join(" ");
    expect(() => parseCsp(policy(`img-src ${hosts}`))).toThrow(`hasta ${CSP_MAX_LENGTH}`);
  });
});

describe("the policy of the site", () => {
  it("is valid and fits in the header", async () => {
    const value = await loadCsp();
    expect(value.length).toBeLessThanOrEqual(CSP_MAX_LENGTH);
    expect(value).toMatch(/^default-src 'self'; /);
  });

  it("keeps scripts to the site's own files and cannot be framed", async () => {
    const directives = new Map(
      (await loadCsp()).split("; ").map((d) => [d.split(" ")[0], d.slice(d.indexOf(" ") + 1)]),
    );
    expect(directives.get("script-src")).toBe("'self'");
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'none'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
  });
});
