// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { LINKS } from "../../app/links";
import { repositoryUrl, reportIssueUrl } from "./report-issue";

describe("repositoryUrl", () => {
  it("uses VITE_REPO_URL without the trailing slash", () => {
    expect(repositoryUrl("https://github.com/someone/fork/")).toBe(
      "https://github.com/someone/fork",
    );
  });

  it("falls back to the official repository when unset, empty or not an https URL", () => {
    expect(repositoryUrl(undefined)).toBe(LINKS.repository);
    expect(repositoryUrl("  ")).toBe(LINKS.repository);
    expect(repositoryUrl("github.com/someone/fork")).toBe(LINKS.repository);
    expect(repositoryUrl("http://github.com/someone/fork")).toBe(LINKS.repository);
  });
});

describe("reportIssueUrl", () => {
  it("opens the scenario error form prefilled with id, version and slot", () => {
    const url = new URL(
      reportIssueUrl("https://github.com/someone/fork", {
        scenarioId: "serverless-pdf-processing",
        version: 3,
        slotId: "upload-store",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe("https://github.com/someone/fork/issues/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: "error-en-escenario.yml",
      title: "[serverless-pdf-processing] ",
      scenario: "serverless-pdf-processing",
      version: "3",
      slot: "upload-store",
    });
  });

  it("leaves the slot out when none is selected", () => {
    const url = new URL(
      reportIssueUrl(LINKS.repository, { scenarioId: "x-y", version: 1, slotId: null }),
    );
    expect(url.searchParams.has("slot")).toBe(false);
  });
});
