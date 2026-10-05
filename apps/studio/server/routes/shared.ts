// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// /api/shared: catalog, categories, confusion groups, areas, game-rules and badges, for the live
// validation in the browser (RF-STU-07).
import { Hono } from "hono";
import { SharedResponseSchema } from "../../shared/api.js";
import type { ContentStore } from "../content-store.js";

export const sharedRoutes = (store: ContentStore): Hono => {
  const routes = new Hono();
  routes.get("/", async (c) => c.json(SharedResponseSchema.parse(await store.readShared())));
  return routes;
};
