// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /api/scenarios: list, read, save (RF-STU-02, RF-STU-14) and create (RF-STU-01). No routes to
// delete or rename (S8).
import { MAX_LENGTH } from "@blueprint/scenario-schema";
import { Hono, type Context } from "hono";
import {
  CreateRequestSchema,
  CreateResponseSchema,
  SaveRequestSchema,
  SaveResponseSchema,
  ScenarioFileResponseSchema,
  ScenarioIdSchema,
  ScenarioListResponseSchema,
} from "../../shared/api.js";
import type { ContentStore } from "../content-store.js";
import { errorResponse, StudioError } from "../errors.js";

const invalidId = (): StudioError =>
  new StudioError(
    400,
    "invalid-id",
    "El id del escenario tiene que estar en kebab-case (minúsculas, números y guiones) y tener entre 3 y 64 caracteres.",
  );

/** S5: the id is checked against the schema pattern before any call to the file system. */
const scenarioId = (c: Context): string => {
  const id = c.req.param("id") ?? "";
  if (!ScenarioIdSchema.safeParse(id).success) throw invalidId();
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

  routes.post("/", async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return errorResponse(c, 400, "bad-request", "El cuerpo del pedido no es un JSON válido.");
    }
    // S5: the new id, and the id of a duplicated scenario, are checked before anything else.
    const fields =
      typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const ids = fields.source === "duplicate" ? [fields.id, fields.from] : [fields.id];
    if (ids.some((id) => !ScenarioIdSchema.safeParse(id).success)) throw invalidId();
    const request = CreateRequestSchema.safeParse(body);
    if (!request.success) {
      return errorResponse(
        c,
        400,
        "bad-request",
        `El cuerpo del pedido tiene que ser { id, title, source: "empty" | "template" | "duplicate", from? }, con un título de 1 a ${MAX_LENGTH.title} caracteres y "from" solo para una plantilla o un escenario a duplicar.`,
      );
    }
    const created = await store.createScenario(request.data);
    return c.json(CreateResponseSchema.parse(created), 201);
  });

  return routes;
};
