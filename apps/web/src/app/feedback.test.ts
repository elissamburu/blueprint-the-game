// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";
import { feedbackUrl } from "./feedback";

const REPOSITORY = "https://github.com/someone/fork";
const ISSUE_FORM = "https://github.com/someone/fork/issues/new?template=feedback-beta.yml";

describe("feedbackUrl", () => {
  it("uses VITE_FEEDBACK_URL when it is an https URL", () => {
    expect(feedbackUrl(" https://forms.example.com/beta?x=1 ", REPOSITORY)).toBe(
      "https://forms.example.com/beta?x=1",
    );
  });

  it("opens the feedback issue form of the repository when unset, empty or not https", () => {
    expect(feedbackUrl(undefined, REPOSITORY)).toBe(ISSUE_FORM);
    expect(feedbackUrl("  ", REPOSITORY)).toBe(ISSUE_FORM);
    expect(feedbackUrl("forms.example.com/beta", REPOSITORY)).toBe(ISSUE_FORM);
    expect(feedbackUrl("http://forms.example.com/beta", REPOSITORY)).toBe(ISSUE_FORM);
    expect(feedbackUrl("javascript:alert(1)", REPOSITORY)).toBe(ISSUE_FORM);
  });
});
