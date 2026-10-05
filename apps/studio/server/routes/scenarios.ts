// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /api/scenarios: list, read and save (RF-STU-02, RF-STU-14). No routes to delete or rename (S8);
// creating arrives with RF-STU-01.
import { Hono, type Context } from "hono";
import {
  SaveRequestSchema,
  SaveResponseSchema,
  ScenarioFileResponseSchema,
  ScenarioIdSchema,
  ScenarioListResponseSchema,
} from "../../shared/api.js";
import type { ContentStore } from "../content-store.js";
import { errorResponse, StudioError } from "../errors.js";

/** S5: the id is checked against the schema pattern before any call to the file system. */
const scenarioId = (c: Context): string => {
  const id = c.req.param("id") ?? "";
  if (!ScenarioIdSchema.safeParse(id).success) {
    throw new StudioError(
      400,
      "invalid-id",
      "El id del escenario tiene que estar en kebab-case (minúsculas, números y guiones) y tener entre 3 y 64 caracteres.",
    );
  }
  return id;
};

export const scenarioRoutes = (store: ContentStore): Hono => {
  const routes = new Hono();

  routes.get("/", async (c) =>
    c.json(ScenarioListResponseSchema.parse({ scenarios: await store.listScenarios() })),
  );

  routes.get("/:id", async (c) =>
    c.json(ScenarioFileResponseSchema.parse(await store.readScenario(scenarioId(c)))),
  );

  routes.put("/:id", async (c) => {
    const id = scenarioId(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return errorResponse(c, 400, "bad-request", "El cuerpo del pedido no es un JSON válido.");
    }
    const request = SaveRequestSchema.safeParse(body);
    if (!request.success) {
      return errorResponse(
        c,
        400,
        "bad-request",
        "El cuerpo del pedido tiene que ser { yaml, baseHash }.",
      );
    }
    const saved = await store.saveScenario(id, request.data.yaml, request.data.baseHash);
    return c.json(SaveResponseSchema.parse(saved));
  });

  return routes;
};
