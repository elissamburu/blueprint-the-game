// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InlineMarkdown } from "./InlineMarkdown";

afterEach(cleanup);

const html = (text: string) => render(<InlineMarkdown text={text} />).container.innerHTML;

describe("InlineMarkdown", () => {
  it("renders bold, italic and code", () => {
    expect(html("Suben **comprobantes en PDF** y *rápido* con `s3://`.")).toBe(
      "Suben <strong>comprobantes en PDF</strong> y <em>rápido</em> con <code>s3://</code>.",
    );
  });

  it("renders https links in a new tab", () => {
    expect(html("Ver [la guía](https://docs.aws.amazon.com/x).")).toBe(
      'Ver <a href="https://docs.aws.amazon.com/x" target="_blank" rel="noreferrer" class="text-primary underline underline-offset-4">la guía</a>.',
    );
  });

  it("leaves other markup as plain, escaped text", () => {
    expect(html("[mal](javascript:alert(1)) <b>x</b> 2 * 3 * 4")).toBe(
      "[mal](javascript:alert(1)) &lt;b&gt;x&lt;/b&gt; 2 * 3 * 4",
    );
  });
});
