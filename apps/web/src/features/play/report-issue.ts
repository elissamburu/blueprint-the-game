// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// "Reportar un problema en este escenario" (RF-PLAY-13): a new GitHub issue with the
// error-en-escenario.yml form, prefilled through the issue form URL parameters (one per field
// id). The repository comes from VITE_REPO_URL so forks point to their own.
import * as z from "zod";
import { LINKS } from "../../app/links";

export const ISSUE_TEMPLATE = "error-en-escenario.yml";

const RepositoryUrlSchema = z.url({ protocol: /^https$/ });

/** VITE_REPO_URL when it is an https URL, else the official repository. No trailing slash. */
export const repositoryUrl = (configured: string | undefined): string => {
  const parsed = RepositoryUrlSchema.safeParse(configured?.trim());
  return (parsed.success ? parsed.data : LINKS.repository).replace(/\/+$/, "");
};

export interface IssueContext {
  readonly scenarioId: string;
  readonly version: number;
  /** Slot selected or in the feedback panel, if any. */
  readonly slotId: string | null;
}

export const reportIssueUrl = (repository: string, context: IssueContext): string => {
  const url = new URL(`${repository}/issues/new`);
  url.searchParams.set("template", ISSUE_TEMPLATE);
  url.searchParams.set("title", `[${context.scenarioId}] `);
  url.searchParams.set("scenario", context.scenarioId);
  url.searchParams.set("version", String(context.version));
  if (context.slotId !== null) url.searchParams.set("slot", context.slotId);
  return url.toString();
};
