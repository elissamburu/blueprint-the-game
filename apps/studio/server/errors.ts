// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ErrorResponseSchema, type ErrorCode } from "../shared/api.js";

/** A failure the API reports with its status and a Spanish message (never a stack trace). */
export class StudioError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: ErrorCode,
    message: string,
    readonly line?: number,
  ) {
    super(message);
  }
}

/** JSON error response, validated with its schema like every other response (S10). */
export const errorResponse = (
  c: Context,
  status: ContentfulStatusCode,
  code: ErrorCode,
  message: string,
  line?: number,
): Response =>
  c.json(
    ErrorResponseSchema.parse({
      error: { code, message, ...(line === undefined ? {} : { line }) },
    }),
    status,
  );
