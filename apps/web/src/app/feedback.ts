// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Contanos qué te pareció" (beta notice): VITE_FEEDBACK_URL when the deploy sets an external
// form; without it, a new GitHub issue with the feedback-beta.yml form in the repository.
import * as z from "zod";

export const FEEDBACK_TEMPLATE = "feedback-beta.yml";

const FeedbackUrlSchema = z.url({ protocol: /^https$/ });

/** VITE_FEEDBACK_URL when it is an https URL, else the feedback issue form of `repository`. */
export const feedbackUrl = (configured: string | undefined, repository: string): string => {
  const parsed = FeedbackUrlSchema.safeParse(configured?.trim());
  if (parsed.success) return parsed.data;
  const url = new URL(`${repository}/issues/new`);
  url.searchParams.set("template", FEEDBACK_TEMPLATE);
  return url.toString();
};
