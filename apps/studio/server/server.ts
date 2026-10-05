// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Starts the Hono app on 127.0.0.1 (S1).
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { createApp, type AppOptions } from "./app.js";
import { HOST } from "./config.js";

export interface RunningServer {
  /** http://127.0.0.1:<port> */
  url: string;
  address: AddressInfo;
  close: () => Promise<void>;
}

export const startServer = (options: AppOptions): Promise<RunningServer> =>
  new Promise((resolve, reject) => {
    const app = createApp(options);
    // S1: the hostname is the HOST constant, never an option.
    const server = serve({ fetch: app.fetch, hostname: HOST, port: options.port }, (info) => {
      server.off("error", reject);
      resolve({
        url: `http://${HOST}:${info.port}`,
        address: info,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((error) => (error === undefined ? done() : fail(error)));
          }),
      });
    });
    server.once("error", reject);
  });
