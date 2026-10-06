// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reloading the page is the only way to get a new session token (S3, S12): the server leaves it in
// the index.html it serves. Retrying a request with the old one fails again.
import { ApiError } from "../api/client";

export const isTokenError = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "invalid-token";

export const reloadPage = (): void => {
  window.location.reload();
};
