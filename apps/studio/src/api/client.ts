// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Client of the Studio API. Every request carries the session token (S3) and every response is
// parsed with the schemas of shared/api.ts (S10).
import type * as z from "zod";
import {
  CreateResponseSchema,
  ErrorResponseSchema,
  SaveResponseSchema,
  ScenarioFileResponseSchema,
  ScenarioListResponseSchema,
  SharedResponseSchema,
  TOKEN_HEADER,
  TOKEN_META,
  type CreateRequest,
  type ErrorCode,
  type SaveRequest,
} from "../../shared/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly line?: number,
  ) {
    super(message);
  }
}

let token = "";

/**
 * Takes the token the server left in index.html and removes the tag: from then on it lives only
 * in this module's memory (S12).
 */
export const initToken = (doc: Document = document): void => {
  const meta = doc.querySelector<HTMLMetaElement>(`meta[name="${TOKEN_META}"]`);
  token = meta?.content ?? "";
  meta?.remove();
};

/** For tests. */
export const setToken = (value: string): void => {
  token = value;
};

const request = async <S extends z.ZodType>(
  schema: S,
  url: string,
  init: RequestInit = {},
): Promise<z.output<S>> => {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "same-origin",
      headers: {
        [TOKEN_HEADER]: token,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
    });
  } catch {
    throw new ApiError(
      0,
      "internal",
      "No hay conexión con el servidor del Studio: ¿sigue corriendo pnpm studio?",
    );
  }
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = ErrorResponseSchema.safeParse(body);
    if (error.success) {
      const { code, message, line } = error.data.error;
      throw new ApiError(response.status, code, message, line);
    }
    throw new ApiError(response.status, "internal", `El servidor respondió ${response.status}.`);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(response.status, "internal", "El servidor respondió algo inesperado.");
  }
  return parsed.data;
};

export const api = {
  listScenarios: () => request(ScenarioListResponseSchema, "/api/scenarios"),
  getScenario: (id: string) =>
    request(ScenarioFileResponseSchema, `/api/scenarios/${encodeURIComponent(id)}`),
  saveScenario: (id: string, body: SaveRequest) =>
    request(SaveResponseSchema, `/api/scenarios/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  createScenario: (body: CreateRequest) =>
    request(CreateResponseSchema, "/api/scenarios", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getShared: () => request(SharedResponseSchema, "/api/shared"),
};
